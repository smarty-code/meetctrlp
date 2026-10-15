using System.Globalization;
using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>Google rejected the refresh token (expired, revoked, user disabled). Retrying won't help.</summary>
public sealed class TokenInvalidException(string message) : Exception(message);

/// <summary>No token right now (network, Google 5xx, not configured yet). Worth retrying later.</summary>
public sealed class TokenUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

public sealed record IdTokenSnapshot(string IdToken, DateTimeOffset ExpiresAt, IdTokenClaims Claims);

public interface IIdTokenSource
{
    /// <summary>The cached token, even if it is about to expire. Null when there is none.</summary>
    IdTokenSnapshot? Current { get; }

    /// <summary>
    /// A token with more than a minute left, refreshing if needed. Returns null when nobody is signed in
    /// on this PC. Throws <see cref="TokenInvalidException"/> or <see cref="TokenUnavailableException"/>.
    /// </summary>
    Task<IdTokenSnapshot?> GetAsync(bool forceRefresh, CancellationToken cancellationToken);
}

/// <summary>
/// Owns the PC's Firebase login (implementation plan 5.2 and 10.2): turns the refresh token in Credential
/// Manager into ID tokens with the Secure Token API. Refreshes are single-flight, run at 55 of 60 minutes
/// while signed in, and on demand. Ported from the doorbell spike's TokenClient.
/// </summary>
public sealed class FirebaseTokenManager : IIdTokenSource
{
    public const string SecureTokenEndpoint = "https://securetoken.googleapis.com/v1/token";

    /// <summary>A cached token is handed out only while it has more than this left.</summary>
    public static readonly TimeSpan MinimumLife = TimeSpan.FromSeconds(60);

    /// <summary>Refresh this long before expiry: at 55 minutes for Firebase's 60-minute tokens.</summary>
    public static readonly TimeSpan RefreshLead = TimeSpan.FromMinutes(5);

    public static readonly TimeSpan InitialBackoff = TimeSpan.FromSeconds(1);
    public static readonly TimeSpan MaxBackoff = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(15);

    private readonly AgentCloudContext _context;
    private readonly ISecretStore _secrets;
    private readonly CloudStatus _status;
    private readonly HttpClient _http;
    private readonly TimeProvider _time;
    private readonly Action<string>? _log;
    private readonly string _endpoint;
    private readonly AsyncSignal _changed = new();
    private readonly object _gate = new();

    private IdTokenSnapshot? _current;
    private TaskCompletionSource<IdTokenSnapshot?>? _inflight;
    private long _generation;
    private bool _invalid;
    private bool _lastRefreshFailed;
    private string? _rejectedRefreshToken;

    public FirebaseTokenManager(
        AgentCloudContext context,
        ISecretStore secrets,
        CloudStatus status,
        HttpClient http,
        TimeProvider? time = null,
        Action<string>? log = null,
        string endpoint = SecureTokenEndpoint)
    {
        _context = context;
        _secrets = secrets;
        _status = status;
        _http = http;
        _time = time ?? TimeProvider.System;
        _log = log;
        _endpoint = endpoint;
    }

    public IdTokenSnapshot? Current
    {
        get
        {
            lock (_gate)
            {
                return _current;
            }
        }
    }

    public async Task<IdTokenSnapshot?> GetAsync(bool forceRefresh, CancellationToken cancellationToken)
    {
        TaskCompletionSource<IdTokenSnapshot?> flight;
        long generation;
        var start = false;
        lock (_gate)
        {
            if (!forceRefresh && IsUsable(_current))
            {
                return _current;
            }

            // Single flight: everyone who needs a token while a refresh runs gets that refresh's result.
            if (_inflight is null)
            {
                _inflight = new(TaskCreationOptions.RunContinuationsAsynchronously);
                start = true;
            }

            flight = _inflight;
            generation = _generation;
        }

        if (start)
        {
            PublishState();
            _ = RefreshAsync(flight, generation, forceRefresh ? "forced" : "expired_or_missing");
        }

        return await flight.Task.WaitAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary><c>cloud.session</c> with the login's ID token, so there's no refresh straight after login.</summary>
    public void Seed(string idToken, DateTimeOffset? expiresAt)
    {
        JwtInfo info;
        try
        {
            info = JwtInfo.Decode(idToken);
        }
        catch (Exception exception) when (exception is FormatException or JsonException or ArgumentException)
        {
            _log?.Invoke($"token seed ignored: not a JWT ({exception.GetType().Name})");
            return;
        }

        var now = _time.GetUtcNow();
        var expires = expiresAt ?? now + (info.Lifetime ?? TimeSpan.FromHours(1));
        lock (_gate)
        {
            _generation++;
            _current = new IdTokenSnapshot(idToken, expires, info.Claims);
            _invalid = false;
            _lastRefreshFailed = false;
            _rejectedRefreshToken = null;
        }

        _log?.Invoke($"token seeded expiresInSec={(long)(expires - now).TotalSeconds} shopIdClaim={info.Claims.ShopId ?? "(none)"}");
        _changed.Set();
        PublishState();
    }

    /// <summary><c>cloud.clear</c>: forget everything in memory. The UI clears the stored refresh token itself.</summary>
    public void Clear()
    {
        lock (_gate)
        {
            _generation++;
            _current = null;
            _invalid = false;
            _lastRefreshFailed = false;
            _rejectedRefreshToken = null;
        }

        _log?.Invoke("token cleared");
        _changed.Set();
        PublishState();
    }

    /// <summary>Refreshes at 55 minutes while signed in; after a network error, retries 1 s doubling to 60 s.</summary>
    public async Task RunAsync(CancellationToken stop)
    {
        var backoff = InitialBackoff;
        try
        {
            while (!stop.IsCancellationRequested)
            {
                // Reset before reading, so only a seed or clear that comes after this read cuts a wait short.
                _changed.Reset();
                IdTokenSnapshot? current;
                bool invalid;
                lock (_gate)
                {
                    current = _current;
                    invalid = _invalid;
                }

                if (current is null || invalid)
                {
                    backoff = InitialBackoff;
                    await _changed.WaitAsync(stop).ConfigureAwait(false);
                    continue;
                }

                var wait = current.ExpiresAt - RefreshLead - _time.GetUtcNow();
                if (wait > TimeSpan.Zero)
                {
                    await _changed.WaitAsync(wait, _time, stop).ConfigureAwait(false);
                    continue;
                }

                try
                {
                    await GetAsync(forceRefresh: true, stop).ConfigureAwait(false);
                    backoff = InitialBackoff;
                }
                catch (TokenInvalidException)
                {
                    // State is invalid now; the loop waits for a new session.
                }
                catch (TokenUnavailableException)
                {
                    _log?.Invoke($"token refresh retry in {backoff.TotalSeconds:0}s");
                    await _changed.WaitAsync(backoff, _time, stop).ConfigureAwait(false);
                    backoff = TimeSpan.FromTicks(Math.Min(backoff.Ticks * 2, MaxBackoff.Ticks));
                }
            }
        }
        catch (OperationCanceledException) when (stop.IsCancellationRequested)
        {
        }
    }

    private async Task RefreshAsync(TaskCompletionSource<IdTokenSnapshot?> flight, long generation, string reason)
    {
        IdTokenSnapshot? result = null;
        Exception? error = null;
        try
        {
            result = await RequestAsync(generation, reason).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            error = exception is TokenInvalidException or TokenUnavailableException
                ? exception
                : new TokenUnavailableException($"Token refresh failed: {exception.Message}", exception);
        }

        lock (_gate)
        {
            if (ReferenceEquals(_inflight, flight))
            {
                _inflight = null;
            }

            if (generation != _generation)
            {
                // Seeded or cleared while this ran: its answer belongs to the old session.
                error = null;
                result = IsUsable(_current) ? _current : null;
            }
            else if (error is TokenInvalidException)
            {
                _invalid = true;
                _current = null;
            }
            else if (error is not null)
            {
                _lastRefreshFailed = true;
            }
            else
            {
                // A null result means no refresh token is stored: nobody is signed in.
                _current = result;
                _invalid = false;
                _lastRefreshFailed = false;
            }
        }

        if (error is not null)
        {
            _status.SetLastError(error.Message);
        }

        // No _changed.Set() here: the scheduler drives its own retries, and waking it would skip its backoff.
        PublishState();
        if (error is not null)
        {
            flight.TrySetException(error);
        }
        else
        {
            flight.TrySetResult(result);
        }
    }

    private async Task<IdTokenSnapshot?> RequestAsync(long generation, string reason)
    {
        var apiKey = _context.Config?.FirebaseApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new TokenUnavailableException("The Firebase API key isn't configured yet (cloud.configure).");
        }

        var refreshToken = _secrets.GetRefreshToken();
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return null;
        }

        lock (_gate)
        {
            if (refreshToken == _rejectedRefreshToken)
            {
                throw new TokenInvalidException("Google already rejected this refresh token. Sign in again.");
            }
        }

        var started = _time.GetTimestamp();
        _log?.Invoke($"token refresh start reason={reason}");
        using var timeout = new CancellationTokenSource(RequestTimeout, _time);
        string body;
        int status;
        try
        {
            using var response = await _http.PostAsync(
                $"{_endpoint}?key={Uri.EscapeDataString(apiKey)}",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "refresh_token",
                    ["refresh_token"] = refreshToken,
                }),
                timeout.Token).ConfigureAwait(false);
            status = (int)response.StatusCode;
            body = await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or OperationCanceledException)
        {
            _log?.Invoke($"token refresh network error durationMs={ElapsedMs(started)} error={exception.GetBaseException().Message}");
            throw new TokenUnavailableException($"Token refresh failed: {exception.GetBaseException().Message}", exception);
        }

        if (status is < 200 or > 299)
        {
            var message = ReadGoogleError(body);
            _log?.Invoke($"token refresh failed status={status} error={message} durationMs={ElapsedMs(started)}");
            if (status == 400)
            {
                lock (_gate)
                {
                    _rejectedRefreshToken = refreshToken;
                }

                throw new TokenInvalidException($"Google rejected the refresh token: {message}");
            }

            throw new TokenUnavailableException($"Token refresh failed with HTTP {status}: {message}");
        }

        using var json = JsonDocument.Parse(body);
        var root = json.RootElement;
        var idToken = root.GetProperty("id_token").GetString()
            ?? throw new TokenUnavailableException("Token refresh returned no id_token.");
        var expiresIn = ReadSeconds(root.GetProperty("expires_in"));
        var info = JwtInfo.Decode(idToken);
        var snapshot = new IdTokenSnapshot(idToken, _time.GetUtcNow().AddSeconds(expiresIn), info.Claims);

        var rotated = root.TryGetProperty("refresh_token", out var next)
            && next.GetString() is { Length: > 0 } nextToken
            && nextToken != refreshToken;
        if (rotated)
        {
            // Don't bring a signed-out session back: store only if nothing changed while the call ran.
            bool current;
            lock (_gate)
            {
                current = generation == _generation;
            }

            if (current && _secrets.GetRefreshToken() == refreshToken)
            {
                _secrets.SetRefreshToken(next.GetString()!);
            }
        }

        _log?.Invoke(
            $"token refresh ok durationMs={ElapsedMs(started)} expiresInSec={expiresIn} rotated={rotated} shopIdClaim={info.Claims.ShopId ?? "(none)"}");
        return snapshot;
    }

    private bool IsUsable(IdTokenSnapshot? snapshot) =>
        snapshot is not null && snapshot.ExpiresAt - _time.GetUtcNow() > MinimumLife;

    private void PublishState()
    {
        string state;
        lock (_gate)
        {
            state = _invalid
                ? TokenStates.Invalid
                : IsUsable(_current)
                    ? TokenStates.Valid
                    : _inflight is not null || _lastRefreshFailed
                        ? TokenStates.Refreshing
                        : TokenStates.None;
        }

        _status.SetToken(state);
    }

    private long ElapsedMs(long started) => (long)_time.GetElapsedTime(started).TotalMilliseconds;

    private static int ReadSeconds(JsonElement value) => value.ValueKind == JsonValueKind.Number
        ? value.GetInt32()
        : int.Parse(value.GetString() ?? "3600", CultureInfo.InvariantCulture);

    private static string ReadGoogleError(string body)
    {
        try
        {
            using var json = JsonDocument.Parse(body);
            return json.RootElement.GetProperty("error").GetProperty("message").GetString() ?? "unknown";
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return body.Length > 200 ? body[..200] : body;
        }
    }

    /// <summary>The parts of a Firebase ID token the agent reads. The signature isn't checked: Google sent it.</summary>
    internal sealed record JwtInfo(IdTokenClaims Claims, TimeSpan? Lifetime)
    {
        public static JwtInfo Decode(string jwt)
        {
            var parts = jwt.Split('.');
            if (parts.Length < 2)
            {
                throw new FormatException("Not a JWT.");
            }

            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
            using var json = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)));
            var root = json.RootElement;
            var claims = new IdTokenClaims(Text(root, "shopId"), Text(root, "shopUserId"), Text(root, "role"));
            TimeSpan? lifetime = Number(root, "exp") is { } exp && Number(root, "iat") is { } iat && exp > iat
                ? TimeSpan.FromSeconds(exp - iat)
                : null;
            return new JwtInfo(claims, lifetime);
        }

        private static string? Text(JsonElement root, string name) =>
            root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

        private static long? Number(JsonElement root, string name) =>
            root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetInt64() : null;
    }
}
