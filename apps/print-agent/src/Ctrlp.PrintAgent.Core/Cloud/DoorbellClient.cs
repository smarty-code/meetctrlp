using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>Timings from implementation plan 10.3. Tests shorten nothing; they drive a fake clock.</summary>
public sealed class DoorbellOptions
{
    /// <summary>2 × the measured 30 s keep-alive, plus slack.</summary>
    public TimeSpan Watchdog { get; init; } = TimeSpan.FromSeconds(65);

    /// <summary>A stream that got a put and stayed up this long was healthy.</summary>
    public TimeSpan HealthyAfter { get; init; } = TimeSpan.FromSeconds(5);

    public TimeSpan InitialBackoff { get; init; } = TimeSpan.FromSeconds(1);
    public TimeSpan MaxBackoff { get; init; } = TimeSpan.FromSeconds(60);
    public int BrokenBeforeFallback { get; init; } = 3;
    public TimeSpan PollInterval { get; init; } = TimeSpan.FromSeconds(60);
    public TimeSpan PollingPeriod { get; init; } = TimeSpan.FromMinutes(30);
    public TimeSpan PollTimeout { get; init; } = TimeSpan.FromSeconds(15);

    /// <summary>On auth_revoked, refresh first only if the cached token has less than this left.</summary>
    public TimeSpan RevokedRefreshBelow { get; init; } = TimeSpan.FromMinutes(5);

    /// <summary>The value seen right after a start raises attention only if its ring is this recent.</summary>
    public TimeSpan FreshAttention { get; init; } = TimeSpan.FromMinutes(2);

    public int AttentionMemory { get; init; } = 50;

    /// <summary>Multiplier for each backoff wait: 0.8 to 1.2 by default.</summary>
    public Func<double> Jitter { get; init; } = () => 0.8 + Random.Shared.NextDouble() * 0.4;
}

/// <summary>How one connection attempt ended (implementation plan 10.3).</summary>
public enum DoorbellOutcome
{
    /// <summary>Got a put and stayed up 5 s or more, or ended with auth_revoked. Reconnect at once.</summary>
    Healthy,

    /// <summary>DNS, connect or TLS failure, a token refresh network error, or a rejected token. Back off; doesn't count toward polling.</summary>
    Unreachable,

    /// <summary>The server answered but the stream didn't work. Back off; 3 in a row switch to polling.</summary>
    Broken,

    /// <summary>The token is invalid or nobody is signed in. Stop until a new session.</summary>
    Fatal,
}

/// <summary>
/// Listens to <c>/doorbell/{shopId}</c> in Realtime Database over its REST stream (plain HTTPS SSE, no SDK).
/// The doorbell carries timestamps only: a newer <c>workAt</c> asks for a sync, a changed <c>boardAt</c> tells
/// the UI to refetch the board, and a new order in <c>last</c> raises <c>orders.attention</c>.
/// </summary>
public sealed class DoorbellClient
{
    private static readonly string[] AttentionTypes = ["order_submitted", "order_paid"];

    private readonly AgentCloudContext _context;
    private readonly IIdTokenSource _tokens;
    private readonly ISyncTrigger _sync;
    private readonly AgentNotifier _notifier;
    private readonly CloudStatus _status;
    private readonly HttpClient _http;
    private readonly TimeProvider _time;
    private readonly DoorbellOptions _options;
    private readonly Action<string>? _log;

    private readonly object _gate = new();
    private readonly AsyncSignal _wake = new();
    private readonly AsyncSignal _renewed = new();
    private DoorbellTarget? _target;
    private CancellationTokenSource? _runCts;
    private Connection? _connection;
    private int _connectionSeq;

    // Touched only by the run loop.
    private JsonNode? _value;
    private bool _evaluatedSinceStart;
    private double _lastWorkAt;
    private double _lastBoardAt;
    private readonly Queue<string> _attentionOrder = new();
    private readonly HashSet<string> _attentionSeen = new(StringComparer.Ordinal);
    private bool _forceRefreshNext;

    public DoorbellClient(
        AgentCloudContext context,
        IIdTokenSource tokens,
        ISyncTrigger sync,
        AgentNotifier notifier,
        CloudStatus status,
        HttpClient http,
        TimeProvider? time = null,
        DoorbellOptions? options = null,
        Action<string>? log = null)
    {
        _context = context;
        _tokens = tokens;
        _sync = sync;
        _notifier = notifier;
        _status = status;
        _http = http;
        _time = time ?? TimeProvider.System;
        _options = options ?? new DoorbellOptions();
        _log = log;
        _target = DoorbellTarget.From(context);
        context.Changed += OnContextChanged;
        context.SessionRenewed += OnSessionRenewed;
    }

    /// <summary>Raised after each stream event is handled (tests wait on it instead of on the clock).</summary>
    internal event Action<string>? EventHandled;

    /// <summary>
    /// A network change or a resume from sleep: cut short any backoff or poll wait. On resume, also close
    /// the current stream, because a socket from before sleep is usually dead.
    /// </summary>
    public void Wake(string reason, bool closeStream)
    {
        _log?.Invoke($"doorbell wake reason={reason} closeStream={closeStream}");
        _wake.Set();
        if (!closeStream)
        {
            return;
        }

        Connection? connection;
        lock (_gate)
        {
            connection = _connection;
        }

        connection?.Close("wake");
    }

    public async Task RunAsync(CancellationToken stop)
    {
        while (!stop.IsCancellationRequested)
        {
            DoorbellTarget? target;
            CancellationTokenSource run;
            lock (_gate)
            {
                target = _target;
                run = _runCts = CancellationTokenSource.CreateLinkedTokenSource(stop);
            }

            try
            {
                if (target is null)
                {
                    _status.SetDoorbell(DoorbellStates.Offline);
                    await Task.Delay(Timeout.InfiniteTimeSpan, _time, run.Token).ConfigureAwait(false);
                    continue;
                }

                _renewed.Reset();
                StartFresh();
                _log?.Invoke($"doorbell start shopId={target.ShopId}");
                await RunTargetAsync(target, run.Token).ConfigureAwait(false);

                // Fatal: the token is invalid or nobody is signed in. Wait for a new session.
                _status.SetDoorbell(DoorbellStates.Offline);
                _log?.Invoke("doorbell stopped until a new session");
                await _renewed.WaitAsync(run.Token).ConfigureAwait(false);
            }
            catch (Exception) when (run.IsCancellationRequested)
            {
                // The shop, database or session changed or was cleared (start over), or the agent is stopping.
            }
            catch (Exception exception)
            {
                // A bug must not end the doorbell for the rest of the day: log, pause, start over.
                _log?.Invoke($"doorbell loop failed: {exception}");
                _status.SetDoorbell(DoorbellStates.Offline);
                try
                {
                    await Task.Delay(_options.MaxBackoff, _time, run.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                }
            }
        }

        _status.SetDoorbell(DoorbellStates.Offline);
        _log?.Invoke("doorbell closed");
    }

    private async Task RunTargetAsync(DoorbellTarget target, CancellationToken cancellationToken)
    {
        var backoff = _options.InitialBackoff;
        var broken = 0;
        long? pollingSince = null;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (pollingSince is { } since)
            {
                if (_time.GetElapsedTime(since) < _options.PollingPeriod)
                {
                    _status.SetDoorbell(DoorbellStates.Polling);
                    if (await PollOnceAsync(target, cancellationToken).ConfigureAwait(false) == DoorbellOutcome.Fatal)
                    {
                        return;
                    }

                    await _wake.WaitAsync(_options.PollInterval, _time, cancellationToken).ConfigureAwait(false);
                    continue;
                }

                pollingSince = null;
                _log?.Invoke("doorbell polling fallback ended; trying the stream");
            }

            _status.SetDoorbell(DoorbellStates.Connecting);
            var outcome = await StreamOnceAsync(target, cancellationToken).ConfigureAwait(false);
            switch (outcome)
            {
                case DoorbellOutcome.Fatal:
                    return;
                case DoorbellOutcome.Healthy:
                    backoff = _options.InitialBackoff;
                    broken = 0;
                    continue;
                case DoorbellOutcome.Broken:
                    broken++;
                    _status.SetDoorbell(DoorbellStates.Connecting);
                    break;
                case DoorbellOutcome.Unreachable:
                    // Polling would fail too, so being offline never counts toward the fallback.
                    _status.SetDoorbell(DoorbellStates.Offline);
                    break;
            }

            if (broken >= _options.BrokenBeforeFallback)
            {
                broken = 0;
                pollingSince = _time.GetTimestamp();
                _log?.Invoke($"doorbell polling fallback start minutes={_options.PollingPeriod.TotalMinutes:0}");
                _status.SetLastError("The doorbell stream isn't getting through on this network; polling every minute.");
                continue;
            }

            var wait = TimeSpan.FromTicks((long)(backoff.Ticks * _options.Jitter()));
            _log?.Invoke($"doorbell reconnect waitMs={(long)wait.TotalMilliseconds} after={outcome} broken={broken}");
            await _wake.WaitAsync(wait, _time, cancellationToken).ConfigureAwait(false);
            backoff = TimeSpan.FromTicks(Math.Min(backoff.Ticks * 2, _options.MaxBackoff.Ticks));
        }
    }

    private async Task<DoorbellOutcome> StreamOnceAsync(DoorbellTarget target, CancellationToken cancellationToken)
    {
        var (outcome, token) = await GetTokenAsync(cancellationToken).ConfigureAwait(false);
        if (token is null)
        {
            return outcome;
        }

        using var connectionCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var connection = new Connection(++_connectionSeq, connectionCts, _time.GetTimestamp());
        lock (_gate)
        {
            _connection = connection;
        }

        var watchdog = WatchAsync(connection);
        long? connectedAt = null;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, DoorbellUri(target, token.IdToken));
            request.Headers.Accept.ParseAdd("text/event-stream");
            _log?.Invoke($"doorbell connect conn={connection.Seq}");

            HttpResponseMessage response;
            try
            {
                response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, connectionCts.Token)
                    .ConfigureAwait(false);
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested && connection.EndReason is null &&
                                              exception is HttpRequestException or IOException or OperationCanceledException)
            {
                _log?.Invoke($"doorbell connect failed conn={connection.Seq} error={exception.GetBaseException().Message}");
                return DoorbellOutcome.Unreachable;
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                return Classify(connection, null); // the watchdog or a wake closed it before headers arrived
            }

            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    var status = (int)response.StatusCode;
                    _log?.Invoke($"doorbell http error conn={connection.Seq} status={status} body={await ReadSnippetAsync(response, connectionCts.Token).ConfigureAwait(false)}");
                    if (response.StatusCode == HttpStatusCode.Unauthorized)
                    {
                        // The token was refused. Polling would be refused too, so this doesn't count as broken.
                        _forceRefreshNext = true;
                        return DoorbellOutcome.Unreachable;
                    }

                    return DoorbellOutcome.Broken;
                }

                connectedAt = _time.GetTimestamp();
                _log?.Invoke($"doorbell connected conn={connection.Seq} http={response.Version}");
                try
                {
                    await using var body = await response.Content.ReadAsStreamAsync(connectionCts.Token).ConfigureAwait(false);
                    using var reader = new StreamReader(body, Encoding.UTF8);
                    await foreach (var sse in SseParser.ReadAsync(reader, connectionCts.Token).ConfigureAwait(false))
                    {
                        connection.Touch(_time.GetTimestamp());
                        var end = HandleEvent(sse, connection);
                        EventHandled?.Invoke(sse.Event);
                        if (end is not null)
                        {
                            connection.End(end);
                            break;
                        }
                    }

                    connection.End("server_closed");
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    connection.End("cancelled"); // keeps the watchdog's or wake's reason if it set one first
                }
                catch (Exception exception) when (!cancellationToken.IsCancellationRequested &&
                                                  exception is IOException or HttpRequestException)
                {
                    connection.End("error: " + exception.GetBaseException().Message);
                }
            }
        }
        finally
        {
            connectionCts.Cancel(); // stops the watchdog
            await watchdog.ConfigureAwait(false);
            lock (_gate)
            {
                if (ReferenceEquals(_connection, connection))
                {
                    _connection = null;
                }
            }
        }

        return Classify(connection, connectedAt);
    }

    private DoorbellOutcome Classify(Connection connection, long? connectedAt)
    {
        var connectedFor = connectedAt is { } at ? _time.GetElapsedTime(at) : TimeSpan.Zero;
        var reason = connection.EndReason ?? "unknown";
        var outcome = reason switch
        {
            "auth_revoked" or "wake" => DoorbellOutcome.Healthy,
            "watchdog" or "cancel" => DoorbellOutcome.Broken,
            _ => connection.GotData && connectedFor >= _options.HealthyAfter ? DoorbellOutcome.Healthy : DoorbellOutcome.Broken,
        };
        _log?.Invoke($"doorbell stream end conn={connection.Seq} reason={reason} connectedMs={(long)connectedFor.TotalMilliseconds} outcome={outcome}");
        return outcome;
    }

    /// <summary>Returns a reason when the connection should end.</summary>
    private string? HandleEvent(SseEvent sse, Connection connection)
    {
        switch (sse.Event)
        {
            case "keep-alive":
                return null;

            case "put":
            case "patch":
                try
                {
                    var message = JsonNode.Parse(sse.Data) as JsonObject;
                    Apply(sse.Event, ReadText(message?["path"]) ?? "/", message?["data"]);
                }
                catch (Exception exception) when (exception is JsonException or InvalidOperationException)
                {
                    _log?.Invoke($"doorbell bad {sse.Event} conn={connection.Seq}: {exception.Message}");
                    return null;
                }

                if (!connection.GotData)
                {
                    connection.GotData = true;
                    _wake.Reset();
                    _status.Update(state => state with { Doorbell = DoorbellStates.Connected, LastError = null });
                }

                Evaluate();
                return null;

            case "cancel":
                // Rules denied the read, usually a token without the shop's claims. Refresh before trying again.
                _log?.Invoke($"doorbell cancel conn={connection.Seq} data={sse.Data}");
                _forceRefreshNext = true;
                _status.SetDoorbell(DoorbellStates.Offline);
                return "cancel";

            case "auth_revoked":
                // The connection's token expired (hourly). The 55-minute refresh normally already replaced it,
                // so reconnect with the cached token unless that one is nearly gone too.
                var left = _tokens.Current is { } current ? current.ExpiresAt - _time.GetUtcNow() : TimeSpan.Zero;
                _forceRefreshNext = left < _options.RevokedRefreshBelow || !connection.GotData;
                _log?.Invoke($"doorbell auth_revoked conn={connection.Seq} cachedTokenLeftSec={(long)left.TotalSeconds} refresh={_forceRefreshNext}");
                return "auth_revoked";

            default:
                _log?.Invoke($"doorbell unknown event={sse.Event} conn={connection.Seq}");
                return null;
        }
    }

    private async Task<DoorbellOutcome> PollOnceAsync(DoorbellTarget target, CancellationToken cancellationToken)
    {
        var (outcome, token) = await GetTokenAsync(cancellationToken).ConfigureAwait(false);
        if (token is null)
        {
            return outcome;
        }

        using var timeout = new CancellationTokenSource(_options.PollTimeout, _time);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
        try
        {
            using var response = await _http.GetAsync(DoorbellUri(target, token.IdToken), linked.Token).ConfigureAwait(false);
            var text = await response.Content.ReadAsStringAsync(linked.Token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _log?.Invoke($"doorbell poll failed status={(int)response.StatusCode}");
                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    _forceRefreshNext = true;
                }

                return DoorbellOutcome.Unreachable;
            }

            Apply("put", "/", JsonNode.Parse(text));
            Evaluate();
            return DoorbellOutcome.Healthy;
        }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested &&
                                          exception is HttpRequestException or IOException or OperationCanceledException or JsonException)
        {
            _log?.Invoke($"doorbell poll failed error={exception.GetBaseException().Message}");
            return DoorbellOutcome.Unreachable;
        }
    }

    private async Task<(DoorbellOutcome Outcome, IdTokenSnapshot? Token)> GetTokenAsync(CancellationToken cancellationToken)
    {
        try
        {
            var token = await _tokens.GetAsync(_forceRefreshNext, cancellationToken).ConfigureAwait(false);
            _forceRefreshNext = false;
            if (token is null)
            {
                _log?.Invoke("doorbell: nobody is signed in on this PC");
                return (DoorbellOutcome.Fatal, null);
            }

            return (DoorbellOutcome.Healthy, token);
        }
        catch (TokenInvalidException exception)
        {
            _log?.Invoke($"doorbell: token invalid ({exception.Message})");
            return (DoorbellOutcome.Fatal, null);
        }
        catch (TokenUnavailableException exception)
        {
            _log?.Invoke($"doorbell: no token yet ({exception.Message})");
            return (DoorbellOutcome.Unreachable, null);
        }
    }

    private async Task WatchAsync(Connection connection)
    {
        try
        {
            while (true)
            {
                var remaining = _options.Watchdog - _time.GetElapsedTime(connection.LastEventAt);
                if (remaining <= TimeSpan.Zero)
                {
                    _log?.Invoke($"doorbell watchdog fired conn={connection.Seq} silentSec={_options.Watchdog.TotalSeconds:0}");
                    connection.Close("watchdog");
                    return;
                }

                await Task.Delay(remaining, _time, connection.Token).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException)
        {
        }
    }

    /// <summary>Decisions after each value change (implementation plan 10.3).</summary>
    private void Evaluate()
    {
        var first = !_evaluatedSinceStart;
        _evaluatedSinceStart = true;
        var workAt = ReadNumber(_value?["workAt"]);
        var boardAt = ReadNumber(_value?["boardAt"]);

        if (workAt is { } work && work > _lastWorkAt)
        {
            _lastWorkAt = work;
            _log?.Invoke($"doorbell work workAt={work:0}");
            _sync.Signal("doorbell");
        }

        if (boardAt is { } board && board != _lastBoardAt)
        {
            _lastBoardAt = board;
            _notifier.Publish(RpcNotifications.BoardChanged, new BoardChangedNotification((long)board));
        }

        var last = _value?["last"] as JsonObject;
        var type = ReadText(last?["type"]);
        var orderId = ReadText(last?["orderId"]);
        if (type is null || orderId is null || !AttentionTypes.Contains(type))
        {
            return;
        }

        var key = $"{type}:{orderId}";
        if (!_attentionSeen.Add(key))
        {
            return;
        }

        _attentionOrder.Enqueue(key);
        if (_attentionOrder.Count > _options.AttentionMemory)
        {
            _attentionSeen.Remove(_attentionOrder.Dequeue());
        }

        // The first value after a start carries whatever rang last, possibly hours ago. Only a recent ring is news.
        if (first && !(boardAt is { } at && _time.GetUtcNow().ToUnixTimeMilliseconds() - at <= _options.FreshAttention.TotalMilliseconds))
        {
            _log?.Invoke($"doorbell attention skipped (old at start) type={type} orderId={orderId}");
            return;
        }

        _log?.Invoke($"doorbell attention type={type} orderId={orderId}");
        _notifier.Publish(
            RpcNotifications.OrdersAttention,
            new OrdersAttentionNotification(type, orderId, ReadText(last?["orderNumber"])));
    }

    private void Apply(string kind, string path, JsonNode? data)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (kind == "put")
        {
            SetAt(segments, data?.DeepClone());
            return;
        }

        if (data is JsonObject patch)
        {
            foreach (var (key, node) in patch)
            {
                SetAt([.. segments, key], node?.DeepClone());
            }
        }
    }

    private void SetAt(string[] segments, JsonNode? node)
    {
        if (segments.Length == 0)
        {
            _value = node;
            return;
        }

        if (_value is not JsonObject root)
        {
            root = new JsonObject();
            _value = root;
        }

        var current = root;
        foreach (var segment in segments[..^1])
        {
            if (current[segment] is not JsonObject next)
            {
                next = new JsonObject();
                current[segment] = next;
            }

            current = next;
        }

        if (node is null)
        {
            current.Remove(segments[^1]);
        }
        else
        {
            current[segments[^1]] = node;
        }
    }

    private void StartFresh()
    {
        // In-memory lastWorkAt starts at 0, so the first value after any start syncs once.
        _value = null;
        _evaluatedSinceStart = false;
        _lastWorkAt = 0;
        _lastBoardAt = 0;
        _attentionOrder.Clear();
        _attentionSeen.Clear();
        _forceRefreshNext = false;
        _wake.Reset();
    }

    private void OnContextChanged()
    {
        var next = DoorbellTarget.From(_context);
        CancellationTokenSource? run;
        lock (_gate)
        {
            if (next == _target)
            {
                return;
            }

            _target = next;
            run = _runCts;
        }

        _log?.Invoke(next is null ? "doorbell target cleared" : $"doorbell target shopId={next.ShopId}");
        // Cancel off this thread: the caller is a pipe handler that must return at once.
        _ = Task.Run(() => run?.Cancel());
    }

    private void OnSessionRenewed()
    {
        _renewed.Set();
        _wake.Set();
    }

    internal static Uri DoorbellUri(DoorbellTarget target, string idToken)
    {
        // Keeps any query on the database URL, such as the emulator's ?ns=<instance>.
        var builder = new UriBuilder(target.DatabaseUrl);
        builder.Path = builder.Path.TrimEnd('/') + "/doorbell/" + Uri.EscapeDataString(target.ShopId) + ".json";
        var auth = "auth=" + Uri.EscapeDataString(idToken);
        var query = builder.Query.TrimStart('?');
        builder.Query = query.Length == 0 ? auth : query + "&" + auth;
        return builder.Uri;
    }

    private static async Task<string> ReadSnippetAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            return text.Length > 200 ? text[..200] : text;
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or OperationCanceledException)
        {
            return "(unreadable)";
        }
    }

    private static double? ReadNumber(JsonNode? node) =>
        node is JsonValue value && value.TryGetValue<double>(out var number) ? number : null;

    private static string? ReadText(JsonNode? node) => node switch
    {
        JsonValue value when value.TryGetValue<string>(out var text) => text,
        JsonValue value when value.TryGetValue<double>(out var number) => number.ToString(System.Globalization.CultureInfo.InvariantCulture),
        _ => null,
    };

    internal sealed record DoorbellTarget(string DatabaseUrl, string ShopId)
    {
        public static DoorbellTarget? From(AgentCloudContext context)
        {
            var databaseUrl = context.Config?.DatabaseUrl;
            var shopId = context.Session?.ShopId;
            return string.IsNullOrWhiteSpace(databaseUrl) || string.IsNullOrWhiteSpace(shopId)
                ? null
                : new DoorbellTarget(databaseUrl, shopId);
        }
    }

    private sealed class Connection
    {
        private readonly CancellationTokenSource _cts;
        private long _lastEventAt;
        private string? _endReason;

        public Connection(int seq, CancellationTokenSource cts, long startedAt)
        {
            Seq = seq;
            _cts = cts;
            _lastEventAt = startedAt; // the watchdog also covers waiting for response headers
        }

        public int Seq { get; }
        public bool GotData { get; set; }
        public CancellationToken Token => _cts.Token;
        public long LastEventAt => Interlocked.Read(ref _lastEventAt);
        public string? EndReason => Volatile.Read(ref _endReason);

        public void Touch(long timestamp) => Interlocked.Exchange(ref _lastEventAt, timestamp);

        /// <summary>Records why the connection ended; the first reason wins.</summary>
        public void End(string reason) => Interlocked.CompareExchange(ref _endReason, reason, null);

        public void Close(string reason)
        {
            End(reason);
            try
            {
                _cts.Cancel();
            }
            catch (ObjectDisposedException)
            {
            }
        }
    }
}
