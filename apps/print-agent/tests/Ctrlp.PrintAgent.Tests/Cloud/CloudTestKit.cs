using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace Ctrlp.PrintAgent.Tests.Cloud;

/// <summary>
/// A clock the test moves by hand. <see cref="Advance"/> fires due timers on the calling thread, in order,
/// including timers that their own callbacks create.
/// </summary>
internal sealed class ManualTimeProvider : TimeProvider
{
    private readonly object _gate = new();
    private readonly List<ManualTimer> _timers = [];
    private readonly List<(Func<TimeSpan, bool> Match, TaskCompletionSource Done)> _waiters = [];
    private DateTimeOffset _now = new(2026, 10, 15, 4, 30, 0, TimeSpan.Zero);
    private long _seq;

    public override long TimestampFrequency => TimeSpan.TicksPerSecond;

    public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;

    public override DateTimeOffset GetUtcNow()
    {
        lock (_gate)
        {
            return _now;
        }
    }

    public override long GetTimestamp()
    {
        lock (_gate)
        {
            return _now.UtcTicks;
        }
    }

    public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
    {
        var timer = new ManualTimer(this, callback, state);
        timer.Change(dueTime, period);
        return timer;
    }

    public void Advance(TimeSpan by)
    {
        DateTimeOffset target;
        lock (_gate)
        {
            target = _now + by;
        }

        while (true)
        {
            ManualTimer? next;
            lock (_gate)
            {
                next = _timers
                    .Where(timer => timer.DueAt <= target)
                    .OrderBy(timer => timer.DueAt)
                    .ThenBy(timer => timer.Seq)
                    .FirstOrDefault();
                if (next is null)
                {
                    _now = target;
                    return;
                }

                if (next.DueAt > _now)
                {
                    _now = next.DueAt;
                }

                _timers.Remove(next);
                if (next.Period > TimeSpan.Zero)
                {
                    next.DueAt = _now + next.Period;
                    next.Seq = ++_seq;
                    _timers.Add(next);
                }
            }

            next.Callback(next.State);
        }
    }

    /// <summary>Completes once some pending timer has <paramref name="remaining"/> left to run.</summary>
    public Task WaitForTimerAsync(TimeSpan remaining) => WaitForTimerAsync(left => left == remaining);

    public Task WaitForTimerAsync(Func<TimeSpan, bool> match)
    {
        var done = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        lock (_gate)
        {
            if (_timers.Any(timer => match(timer.DueAt - _now)))
            {
                return Task.CompletedTask;
            }

            _waiters.Add((match, done));
        }

        return done.Task.WaitAsync(TimeSpan.FromSeconds(5));
    }

    public IReadOnlyList<TimeSpan> PendingTimers()
    {
        lock (_gate)
        {
            return _timers.Select(timer => timer.DueAt - _now).OrderBy(left => left).ToList();
        }
    }

    private void Schedule(ManualTimer timer, TimeSpan dueTime, TimeSpan period)
    {
        lock (_gate)
        {
            _timers.Remove(timer);
            if (dueTime == Timeout.InfiniteTimeSpan)
            {
                return;
            }

            timer.DueAt = _now + dueTime;
            timer.Period = period == Timeout.InfiniteTimeSpan ? TimeSpan.Zero : period;
            timer.Seq = ++_seq;
            _timers.Add(timer);
            foreach (var waiter in _waiters.Where(waiter => waiter.Match(timer.DueAt - _now)).ToList())
            {
                _waiters.Remove(waiter);
                waiter.Done.TrySetResult();
            }
        }
    }

    private void Remove(ManualTimer timer)
    {
        lock (_gate)
        {
            _timers.Remove(timer);
        }
    }

    private sealed class ManualTimer(ManualTimeProvider owner, TimerCallback callback, object? state) : ITimer
    {
        public TimerCallback Callback { get; } = callback;
        public object? State { get; } = state;
        public DateTimeOffset DueAt { get; set; }
        public TimeSpan Period { get; set; }
        public long Seq { get; set; }

        public bool Change(TimeSpan dueTime, TimeSpan period)
        {
            owner.Schedule(this, dueTime, period);
            return true;
        }

        public void Dispose() => owner.Remove(this);

        public ValueTask DisposeAsync()
        {
            Dispose();
            return ValueTask.CompletedTask;
        }
    }
}

internal sealed record RecordedRequest(HttpMethod Method, Uri Uri, string Accept, string? Body)
{
    public bool IsToken => Uri.Host == "securetoken.googleapis.com";
    public bool IsStream => Accept.Contains("text/event-stream", StringComparison.Ordinal);
    public bool IsPoll => !IsToken && !IsStream && Uri.AbsolutePath.StartsWith("/doorbell/", StringComparison.Ordinal);

    /// <summary>The <c>auth</c> query value of a doorbell request.</summary>
    public string? Auth => Uri.Query.TrimStart('?').Split('&')
        .Select(part => part.Split('=', 2))
        .Where(pair => pair[0] == "auth")
        .Select(pair => Uri.UnescapeDataString(pair[1]))
        .FirstOrDefault();
}

/// <summary>Records every request and answers with <see cref="Responder"/>.</summary>
internal sealed class FakeHttpHandler : HttpMessageHandler
{
    private readonly object _gate = new();
    private readonly List<RecordedRequest> _requests = [];
    private readonly List<(Func<IReadOnlyList<RecordedRequest>, bool> Match, TaskCompletionSource Done)> _waiters = [];

    public Func<RecordedRequest, CancellationToken, Task<HttpResponseMessage>> Responder { get; set; } =
        (_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));

    public IReadOnlyList<RecordedRequest> Requests
    {
        get
        {
            lock (_gate)
            {
                return _requests.ToList();
            }
        }
    }

    public int Count(Func<RecordedRequest, bool> match) => Requests.Count(match);

    public Task WaitForAsync(Func<RecordedRequest, bool> match, int count)
    {
        var done = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Func<IReadOnlyList<RecordedRequest>, bool> condition = requests => requests.Count(match) >= count;
        lock (_gate)
        {
            if (condition(_requests))
            {
                return Task.CompletedTask;
            }

            _waiters.Add((condition, done));
        }

        return done.Task.WaitAsync(TimeSpan.FromSeconds(5));
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        var recorded = new RecordedRequest(request.Method, request.RequestUri!, request.Headers.Accept.ToString(), body);
        lock (_gate)
        {
            _requests.Add(recorded);
            foreach (var waiter in _waiters.Where(waiter => waiter.Match(_requests)).ToList())
            {
                _waiters.Remove(waiter);
                waiter.Done.TrySetResult();
            }
        }

        return await Responder(recorded, cancellationToken);
    }
}

/// <summary>A response body the test writes server-sent events into.</summary>
internal sealed class SseStream : Stream
{
    private readonly Channel<byte[]> _channel = Channel.CreateUnbounded<byte[]>();
    private byte[]? _current;
    private int _offset;

    public bool Disposed { get; private set; }

    public HttpResponseMessage Response() => new(HttpStatusCode.OK)
    {
        Content = new StreamContent(this) { Headers = { { "Content-Type", "text/event-stream" } } },
    };

    public void Send(string eventName, string data) =>
        _channel.Writer.TryWrite(Encoding.UTF8.GetBytes($"event: {eventName}\ndata: {data}\n\n"));

    public void Put(object? data, string path = "/") =>
        Send("put", JsonSerializer.Serialize(new { path, data }));

    public void Patch(object data, string path = "/") =>
        Send("patch", JsonSerializer.Serialize(new { path, data }));

    public void KeepAlive() => Send("keep-alive", "null");

    public void End() => _channel.Writer.TryComplete();

    public void Fail() => _channel.Writer.TryComplete(new IOException("connection reset"));

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        while (_current is null || _offset >= _current.Length)
        {
            if (!await _channel.Reader.WaitToReadAsync(cancellationToken))
            {
                return 0;
            }

            if (_channel.Reader.TryRead(out _current))
            {
                _offset = 0;
            }
        }

        var count = Math.Min(buffer.Length, _current.Length - _offset);
        _current.AsMemory(_offset, count).CopyTo(buffer);
        _offset += count;
        return count;
    }

    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
        ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

    public override int Read(byte[] buffer, int offset, int count) =>
        ReadAsync(buffer, offset, count, CancellationToken.None).GetAwaiter().GetResult();

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();

    public override long Position
    {
        get => throw new NotSupportedException();
        set => throw new NotSupportedException();
    }

    public override void Flush()
    {
    }

    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

    public override void SetLength(long value) => throw new NotSupportedException();

    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        Disposed = true;
        _channel.Writer.TryComplete();
        base.Dispose(disposing);
    }
}

internal static class TestTokens
{
    /// <summary>An unsigned Firebase-shaped ID token. The agent reads its claims and never checks the signature.</summary>
    public static string Jwt(string label, string shopId = "shop-1", long lifetimeSeconds = 3600)
    {
        var header = Base64Url("""{"alg":"none","typ":"JWT"}""");
        var payload = Base64Url(JsonSerializer.Serialize(new
        {
            shopId,
            shopUserId = "user-1",
            role = "OWNER",
            iat = 1_790_000_000L,
            exp = 1_790_000_000L + lifetimeSeconds,
            label,
        }));
        return $"{header}.{payload}.sig";
    }

    public static HttpResponseMessage Refreshed(string idToken, string refreshToken, int expiresIn = 3600) =>
        Json(HttpStatusCode.OK, new
        {
            id_token = idToken,
            refresh_token = refreshToken,
            expires_in = expiresIn.ToString(System.Globalization.CultureInfo.InvariantCulture),
            token_type = "Bearer",
            user_id = "uid-1",
        });

    public static HttpResponseMessage GoogleError(int status, string message) =>
        Json((HttpStatusCode)status, new { error = new { code = status, message, status = "INVALID_ARGUMENT" } });

    public static HttpResponseMessage Json(HttpStatusCode status, object? body) => new(status)
    {
        Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
    };

    private static string Base64Url(string text) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(text)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
