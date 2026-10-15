using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Core.Cloud;
using Ctrlp.PrintAgent.Ipc;

namespace Ctrlp.PrintAgent.Tests.Cloud;

/// <summary>Implementation plan 10.6 #6: the cloud.* pipe handlers.</summary>
public sealed class CloudHandlerTests : IAsyncDisposable
{
    private readonly FakeHttpHandler _http = new();
    private readonly MemorySecretStore _secrets = new();
    private readonly AgentCloudContext _context = new();
    private readonly RecordingSync _sync = new();
    private readonly CancellationTokenSource _stop = new();
    private readonly AgentCloud _cloud;
    private readonly JsonRpcSession _session;
    private readonly Task _doorbell;

    public CloudHandlerTests()
    {
        var notifier = new AgentNotifier();
        var status = new CloudStatus(notifier);
        var tokens = new FirebaseTokenManager(_context, _secrets, status, new HttpClient(_http));
        _cloud = new AgentCloud(_context, tokens, _sync, status);
        // A live doorbell, so its reaction to context changes is part of what's timed.
        var doorbell = new DoorbellClient(_context, tokens, _sync, notifier, status, new HttpClient(_http));
        _doorbell = doorbell.RunAsync(_stop.Token);

        var runtime = new AgentRuntime(
            new AgentOptions { PipeName = "test", Token = "secret" },
            new StaticPrinterCatalog(),
            new InMemoryJobStore(),
            _secrets,
            cloud: _cloud);
        runtime.MarkReady();
        _session = new JsonRpcSession(runtime.CreateDispatcher(), new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });
    }

    public async ValueTask DisposeAsync()
    {
        _stop.Cancel();
        await _doorbell.WaitAsync(TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task NotificationsReturnInUnder10Milliseconds()
    {
        await Request(RpcMethods.Hello, """{"token":"secret"}""");
        var idToken = TestTokens.Jwt("login");
        var expiresAt = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeMilliseconds();
        string[] frames =
        [
            Notification(RpcMethods.CloudConfigure, """{"serverBaseUrl":"http://localhost:3000","firebaseApiKey":"web-key","databaseUrl":"https://doorbell.test"}"""),
            Notification(RpcMethods.CloudSession, $$"""{"shopId":"shop-1","agentId":"agent-1","idToken":"{{idToken}}","expiresAt":{{expiresAt}}}"""),
            Notification(RpcMethods.SyncRequest, "{}"),
            Notification(RpcMethods.CloudClear, "{}"),
        ];

        // The first round pays for JIT compilation; the second is the measurement.
        foreach (var frame in frames)
        {
            await _session.HandleFrameAsync(Encoding.UTF8.GetBytes(frame), CancellationToken.None);
        }

        foreach (var frame in frames)
        {
            var clock = Stopwatch.StartNew();
            var response = await _session.HandleFrameAsync(Encoding.UTF8.GetBytes(frame), CancellationToken.None);
            clock.Stop();

            Assert.Null(response); // notifications get no reply
            Assert.True(clock.Elapsed < TimeSpan.FromMilliseconds(10), $"{frame} took {clock.Elapsed.TotalMilliseconds:0.0} ms");
        }

        Assert.Null(_context.Session); // the last frame was cloud.clear
        Assert.Equal(4, _sync.Reasons.Count(reason => reason == "session" || reason == "request"));
    }

    [Fact]
    public async Task GetIdTokenReturnsTheCachedTokenWithoutHttp()
    {
        await Request(RpcMethods.Hello, """{"token":"secret"}""");
        var idToken = TestTokens.Jwt("login");
        var expiresAt = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeMilliseconds();
        await Request(RpcMethods.CloudConfigure, """{"serverBaseUrl":"http://localhost:3000","firebaseApiKey":"web-key","databaseUrl":""}""");
        await Request(RpcMethods.CloudSession, $$"""{"shopId":"shop-1","agentId":"agent-1","idToken":"{{idToken}}","expiresAt":{{expiresAt}}}""");

        var result = (await Request(RpcMethods.CloudGetIdToken, "{}")).GetProperty("result");

        Assert.True(result.GetProperty("signedIn").GetBoolean());
        Assert.Equal(idToken, result.GetProperty("idToken").GetString());
        Assert.Equal(expiresAt, result.GetProperty("expiresAt").GetInt64());
        Assert.Equal("shop-1", result.GetProperty("claims").GetProperty("shopId").GetString());
        Assert.Equal("OWNER", result.GetProperty("claims").GetProperty("role").GetString());
        Assert.Empty(_http.Requests);
    }

    [Fact]
    public async Task GetIdTokenSaysSignedOutWithoutARefreshToken()
    {
        await Request(RpcMethods.Hello, """{"token":"secret"}""");
        await Request(RpcMethods.CloudConfigure, """{"serverBaseUrl":"http://localhost:3000","firebaseApiKey":"web-key","databaseUrl":""}""");

        var result = (await Request(RpcMethods.CloudGetIdToken, """{"forceRefresh":true}""")).GetProperty("result");

        Assert.False(result.GetProperty("signedIn").GetBoolean());
        Assert.False(result.TryGetProperty("idToken", out _));
        Assert.Empty(_http.Requests);
    }

    [Fact]
    public async Task RemovedCredentialMethodsAreGone()
    {
        await Request(RpcMethods.Hello, """{"token":"secret"}""");

        var response = await Request("secrets.setAgentCloudCredential", "{}");

        Assert.Equal(RpcErrorCodes.MethodNotFound, response.GetProperty("error").GetProperty("code").GetInt32());
    }

    private static string Notification(string method, string paramsJson) =>
        $$"""{"jsonrpc":"2.0","method":"{{method}}","params":{{paramsJson}}}""";

    private int _id;

    private async Task<JsonElement> Request(string method, string paramsJson)
    {
        var frame = Encoding.UTF8.GetBytes(
            $$"""{"jsonrpc":"2.0","id":{{++_id}},"method":"{{method}}","params":{{paramsJson}}}""");
        var response = await _session.HandleFrameAsync(frame, CancellationToken.None);
        Assert.NotNull(response);
        using var document = JsonDocument.Parse(response);
        return document.RootElement.Clone();
    }

    private sealed class RecordingSync : ISyncTrigger
    {
        private readonly List<string> _reasons = [];

        public IReadOnlyList<string> Reasons
        {
            get
            {
                lock (_reasons)
                {
                    return _reasons.ToList();
                }
            }
        }

        public void Signal(string reason)
        {
            lock (_reasons)
            {
                _reasons.Add(reason);
            }
        }
    }
}
