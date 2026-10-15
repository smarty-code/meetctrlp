using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Core.Cloud;

namespace Ctrlp.PrintAgent.Tests.Cloud;

/// <summary>Implementation plan 10.6 #2.</summary>
public sealed class FirebaseTokenManagerTests : IDisposable
{
    private readonly ManualTimeProvider _time = new();
    private readonly FakeHttpHandler _http = new();
    private readonly MemorySecretStore _secrets = new();
    private readonly AgentCloudContext _context = new();
    private readonly CloudStatus _status = new(new AgentNotifier());
    private readonly FirebaseTokenManager _tokens;
    private readonly CancellationTokenSource _stop = new();

    public FirebaseTokenManagerTests()
    {
        _context.Configure(new CloudConfig("http://localhost:3000", "web-key", "https://db.example"));
        _secrets.SetRefreshToken("refresh-1");
        _tokens = new FirebaseTokenManager(_context, _secrets, _status, new HttpClient(_http), _time);
    }

    public void Dispose() => _stop.Cancel();

    [Fact]
    public async Task RefreshesWithTheSecureTokenApi()
    {
        var idToken = TestTokens.Jwt("a");
        _http.Responder = (_, _) => Task.FromResult(TestTokens.Refreshed(idToken, "refresh-1"));

        var token = await _tokens.GetAsync(forceRefresh: false, CancellationToken.None);

        Assert.NotNull(token);
        Assert.Equal(idToken, token.IdToken);
        Assert.Equal(_time.GetUtcNow().AddHours(1), token.ExpiresAt);
        Assert.Equal(new IdTokenClaims("shop-1", "user-1", "OWNER"), token.Claims);
        var request = Assert.Single(_http.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("https://securetoken.googleapis.com/v1/token?key=web-key", request.Uri.ToString());
        Assert.Equal("grant_type=refresh_token&refresh_token=refresh-1", request.Body);
        Assert.Equal(TokenStates.Valid, _status.Current.Token);

        // Cached: no second call while the token has more than a minute left.
        _time.Advance(TimeSpan.FromMinutes(58));
        Assert.Same(token, await _tokens.GetAsync(forceRefresh: false, CancellationToken.None));
        Assert.Single(_http.Requests);
    }

    [Fact]
    public async Task StoresARotatedRefreshToken()
    {
        _http.Responder = (_, _) => Task.FromResult(TestTokens.Refreshed(TestTokens.Jwt("a"), "refresh-2"));

        await _tokens.GetAsync(forceRefresh: false, CancellationToken.None);

        Assert.Equal("refresh-2", _secrets.GetRefreshToken());
    }

    [Fact]
    public async Task RefreshIsSingleFlight()
    {
        var release = new TaskCompletionSource<HttpResponseMessage>();
        _http.Responder = (_, _) => release.Task;

        var callers = Enumerable.Range(0, 10)
            .Select(i => _tokens.GetAsync(forceRefresh: i % 2 == 0, CancellationToken.None))
            .ToList();
        await _http.WaitForAsync(request => request.IsToken, 1);
        Assert.Equal(TokenStates.Refreshing, _status.Current.Token);
        release.SetResult(TestTokens.Refreshed(TestTokens.Jwt("a"), "refresh-1"));
        var tokens = await Task.WhenAll(callers);

        Assert.Single(_http.Requests);
        Assert.All(tokens, token => Assert.Same(tokens[0], token));
    }

    [Fact]
    public async Task InvalidRefreshTokenMakesTheTokenInvalid()
    {
        _http.Responder = (_, _) => Task.FromResult(TestTokens.GoogleError(400, "INVALID_REFRESH_TOKEN"));

        var error = await Assert.ThrowsAsync<TokenInvalidException>(
            () => _tokens.GetAsync(forceRefresh: false, CancellationToken.None));

        Assert.Contains("INVALID_REFRESH_TOKEN", error.Message);
        Assert.Equal(TokenStates.Invalid, _status.Current.Token);
        // The same refresh token isn't sent to Google again.
        await Assert.ThrowsAsync<TokenInvalidException>(() => _tokens.GetAsync(forceRefresh: true, CancellationToken.None));
        Assert.Single(_http.Requests);

        // A new login stores a new refresh token; that one is tried.
        _secrets.SetRefreshToken("refresh-new");
        _http.Responder = (_, _) => Task.FromResult(TestTokens.Refreshed(TestTokens.Jwt("b"), "refresh-new"));
        Assert.NotNull(await _tokens.GetAsync(forceRefresh: false, CancellationToken.None));
        Assert.Equal(TokenStates.Valid, _status.Current.Token);
    }

    [Fact]
    public async Task NetworkErrorsAreTransient()
    {
        _http.Responder = (_, _) => throw new HttpRequestException("No such host is known.");

        await Assert.ThrowsAsync<TokenUnavailableException>(() => _tokens.GetAsync(forceRefresh: false, CancellationToken.None));

        Assert.Equal(TokenStates.Refreshing, _status.Current.Token);
    }

    [Fact]
    public async Task NoRefreshTokenMeansSignedOut()
    {
        _secrets.ClearRefreshToken();

        Assert.Null(await _tokens.GetAsync(forceRefresh: false, CancellationToken.None));
        Assert.Empty(_http.Requests);
        Assert.Equal(TokenStates.None, _status.Current.Token);
    }

    [Fact]
    public async Task SeededTokenIsUsedWithoutRefreshAndClearForgetsIt()
    {
        var seeded = TestTokens.Jwt("login");
        _tokens.Seed(seeded, _time.GetUtcNow().AddMinutes(60));

        var token = await _tokens.GetAsync(forceRefresh: false, CancellationToken.None);

        Assert.Equal(seeded, token?.IdToken);
        Assert.Empty(_http.Requests);
        _tokens.Clear();
        Assert.Null(_tokens.Current);
        Assert.Equal(TokenStates.None, _status.Current.Token);
    }

    [Fact]
    public async Task RefreshesAt55MinutesWhileSignedIn()
    {
        _tokens.Seed(TestTokens.Jwt("login"), _time.GetUtcNow().AddMinutes(60));
        _http.Responder = (_, _) => Task.FromResult(TestTokens.Refreshed(TestTokens.Jwt("next"), "refresh-1"));
        var loop = _tokens.RunAsync(_stop.Token);

        await _time.WaitForTimerAsync(TimeSpan.FromMinutes(55));
        _time.Advance(TimeSpan.FromMinutes(55) - TimeSpan.FromSeconds(1));
        Assert.Empty(_http.Requests);
        _time.Advance(TimeSpan.FromSeconds(1));
        await _http.WaitForAsync(request => request.IsToken, 1);

        // The next one is scheduled 55 minutes after this refresh.
        await _time.WaitForTimerAsync(TimeSpan.FromMinutes(55));
        Assert.Equal(TestTokens.Jwt("next"), _tokens.Current?.IdToken);
        _stop.Cancel();
        await loop;
    }

    [Fact]
    public async Task ScheduledRefreshBacksOffOnNetworkErrors()
    {
        _tokens.Seed(TestTokens.Jwt("login"), _time.GetUtcNow().AddMinutes(4)); // due already
        var offline = true;
        _http.Responder = (_, _) => offline
            ? throw new HttpRequestException("No such host is known.")
            : Task.FromResult(TestTokens.Refreshed(TestTokens.Jwt("next"), "refresh-1"));
        var loop = _tokens.RunAsync(_stop.Token);

        var attempts = 1;
        foreach (var seconds in new[] { 1, 2, 4, 8, 16, 32, 60, 60 })
        {
            await _http.WaitForAsync(request => request.IsToken, attempts);
            await _time.WaitForTimerAsync(TimeSpan.FromSeconds(seconds));
            _time.Advance(TimeSpan.FromSeconds(seconds));
            attempts++;
        }

        await _http.WaitForAsync(request => request.IsToken, attempts);
        offline = false;
        await _time.WaitForTimerAsync(TimeSpan.FromSeconds(60));
        _time.Advance(TimeSpan.FromSeconds(60));
        await _http.WaitForAsync(request => request.IsToken, attempts + 1);
        await _time.WaitForTimerAsync(TimeSpan.FromMinutes(55));
        Assert.Equal(TokenStates.Valid, _status.Current.Token);
        _stop.Cancel();
        await loop;
    }

    [Fact]
    public async Task ServerErrorsAreTransientNotInvalid()
    {
        _http.Responder = (_, _) => Task.FromResult(TestTokens.GoogleError(503, "UNAVAILABLE"));

        await Assert.ThrowsAsync<TokenUnavailableException>(() => _tokens.GetAsync(forceRefresh: false, CancellationToken.None));

        Assert.Equal(TokenStates.Refreshing, _status.Current.Token);
        Assert.Contains("503", _status.Current.LastError);
    }
}
