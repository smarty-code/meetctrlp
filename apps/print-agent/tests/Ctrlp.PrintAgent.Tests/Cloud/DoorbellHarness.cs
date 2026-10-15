using System.Collections.Concurrent;
using System.Net;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Core.Cloud;

namespace Ctrlp.PrintAgent.Tests.Cloud;

/// <summary>
/// A doorbell client wired to a fake clock, a fake database and a real token manager. Stream requests
/// are answered by <see cref="OnStream"/>; by default each one opens a new <see cref="SseStream"/>.
/// </summary>
internal sealed class DoorbellHarness : IAsyncDisposable
{
    public const string DatabaseUrl = "https://doorbell.test";

    private readonly CancellationTokenSource _stop = new();
    private readonly ConcurrentQueue<(string Method, object Payload)> _notifications = new();
    private readonly ConcurrentDictionary<string, int> _events = new();
    private readonly List<SseStream> _streams = [];
    private int _refreshes;
    private Task? _run;

    public DoorbellHarness()
    {
        Notifier = new AgentNotifier();
        Notifier.Attach((method, payload) =>
        {
            _notifications.Enqueue((method, payload));
            return Task.CompletedTask;
        });
        Status = new CloudStatus(Notifier);
        Http.Responder = RespondAsync;
        OnStream = _ => OpenStream().Response();
        Tokens = new FirebaseTokenManager(Context, Secrets, Status, new HttpClient(Http), Time);
        Doorbell = new DoorbellClient(
            Context,
            Tokens,
            Sync,
            Notifier,
            Status,
            new HttpClient(Http) { Timeout = Timeout.InfiniteTimeSpan },
            Time,
            new DoorbellOptions { Jitter = () => 1.0 });
        Doorbell.EventHandled += name => _events.AddOrUpdate(name, 1, (_, count) => count + 1);
    }

    public ManualTimeProvider Time { get; } = new();
    public FakeHttpHandler Http { get; } = new();
    public MemorySecretStore Secrets { get; } = new();
    public AgentCloudContext Context { get; } = new();
    public AgentNotifier Notifier { get; }
    public CloudStatus Status { get; }
    public FirebaseTokenManager Tokens { get; }
    public CountingSync Sync { get; } = new();
    public DoorbellClient Doorbell { get; }

    /// <summary>Answers a stream request. Throw <see cref="HttpRequestException"/> to look offline.</summary>
    public Func<int, HttpResponseMessage> OnStream { get; set; } = null!;

    public Func<HttpResponseMessage> OnPoll { get; set; } = () => TestTokens.Json(HttpStatusCode.OK, null);

    public Func<int, HttpResponseMessage> OnRefresh { get; set; } =
        n => TestTokens.Refreshed(TestTokens.Jwt($"refreshed-{n}"), "refresh-1");

    public string SeededToken { get; } = TestTokens.Jwt("seeded");

    public int StreamRequests => Http.Count(request => request.IsStream);
    public int PollRequests => Http.Count(request => request.IsPoll);
    public int TokenRequests => Http.Count(request => request.IsToken);
    public RecordedRequest LastStream => Http.Requests.Last(request => request.IsStream);

    public SseStream GetStream(int number)
    {
        lock (_streams)
        {
            return _streams[number - 1];
        }
    }


    public SseStream OpenStream()
    {
        var stream = new SseStream();
        lock (_streams)
        {
            _streams.Add(stream);
        }

        return stream;
    }

    /// <summary>Configures, signs in (seeding a token with <paramref name="tokenLeft"/> to live) and starts.</summary>
    public void Start(TimeSpan? tokenLeft = null, bool seed = true)
    {
        Context.Configure(new CloudConfig("http://localhost:3000", "web-key", DatabaseUrl));
        Secrets.SetRefreshToken("refresh-1");
        if (seed)
        {
            Tokens.Seed(SeededToken, Time.GetUtcNow() + (tokenLeft ?? TimeSpan.FromMinutes(50)));
        }

        Context.SetSession(new CloudSession("shop-1", "agent-1"));
        _run = Doorbell.RunAsync(_stop.Token);
    }

    public async Task<SseStream> WaitForStreamAsync(int number)
    {
        await Eventually(() =>
        {
            lock (_streams)
            {
                return _streams.Count >= number;
            }
        });
        return GetStream(number);
    }

    public Task WaitForEventsAsync(string name, int count) =>
        Eventually(() => _events.GetValueOrDefault(name) >= count);

    public async Task<IReadOnlyList<T>> NotificationsAsync<T>(string method)
    {
        await Notifier.DrainAsync();
        return _notifications.Where(item => item.Method == method).Select(item => (T)item.Payload).ToList();
    }

    public static async Task Eventually(Func<bool> condition, string? because = null)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
        while (!condition())
        {
            if (DateTime.UtcNow > deadline)
            {
                throw new TimeoutException($"Condition not met in 5 s{(because is null ? "" : ": " + because)}.");
            }

            await Task.Delay(2);
        }
    }

    /// <summary>Waits for the pending timer of <paramref name="wait"/>, then moves the clock past it.</summary>
    public async Task AdvanceThroughAsync(TimeSpan wait)
    {
        await Time.WaitForTimerAsync(wait);
        Time.Advance(wait);
    }

    public async ValueTask DisposeAsync()
    {
        _stop.Cancel();
        if (_run is not null)
        {
            await _run.WaitAsync(TimeSpan.FromSeconds(5));
        }
    }

    private Task<HttpResponseMessage> RespondAsync(RecordedRequest request, CancellationToken cancellationToken)
    {
        if (request.IsToken)
        {
            return Task.FromResult(OnRefresh(Interlocked.Increment(ref _refreshes)));
        }

        if (request.IsStream)
        {
            return Task.FromResult(OnStream(StreamRequests));
        }

        return Task.FromResult(OnPoll());
    }

    internal sealed class CountingSync : ISyncTrigger
    {
        private int _count;

        public int Count => Volatile.Read(ref _count);

        public void Signal(string reason) => Interlocked.Increment(ref _count);
    }
}
