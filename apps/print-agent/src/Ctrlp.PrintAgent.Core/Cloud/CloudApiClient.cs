using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>
/// Calls our API as the signed-in shop user: <c>Authorization: Bearer &lt;ID token&gt;</c> from the token
/// manager. On a 401 it refreshes the token once and retries (implementation plan 5.3 and 10.2).
/// </summary>
public sealed class CloudApiClient
{
    private readonly AgentCloudContext _context;
    private readonly IIdTokenSource _tokens;
    private readonly HttpClient _http;
    private readonly Action<string>? _log;

    public CloudApiClient(AgentCloudContext context, IIdTokenSource tokens, HttpClient http, Action<string>? log = null)
    {
        _context = context;
        _tokens = tokens;
        _http = http;
        _log = log;
    }

    public async Task<HttpResponseMessage> SendAsync(
        HttpMethod method,
        string path,
        string? jsonBody,
        CancellationToken cancellationToken)
    {
        var config = _context.Config ?? throw new TokenUnavailableException("The server isn't configured yet (cloud.configure).");
        var token = await _tokens.GetAsync(forceRefresh: false, cancellationToken).ConfigureAwait(false)
            ?? throw new TokenInvalidException("Nobody is signed in on this PC.");
        var response = await SendOnceAsync(config, method, path, jsonBody, token.IdToken, cancellationToken).ConfigureAwait(false);
        if (response.StatusCode != HttpStatusCode.Unauthorized)
        {
            return response;
        }

        response.Dispose();
        _log?.Invoke($"cloud api 401 path={path}; refreshing the token and retrying once");
        token = await _tokens.GetAsync(forceRefresh: true, cancellationToken).ConfigureAwait(false)
            ?? throw new TokenInvalidException("Nobody is signed in on this PC.");
        return await SendOnceAsync(config, method, path, jsonBody, token.IdToken, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Best effort on the way out: <c>POST /devices/offline</c> marks this PC's printers OFFLINE so routing
    /// stops sending them work. Does nothing without an active session; never throws.
    /// </summary>
    public async Task MarkDeviceOfflineAsync(TimeSpan timeout)
    {
        var session = _context.Session;
        if (session is null || _context.Config is null)
        {
            _log?.Invoke("device offline skipped: no session");
            return;
        }

        using var cts = new CancellationTokenSource(timeout);
        try
        {
            using var response = await SendAsync(
                HttpMethod.Post,
                "/api/v1/devices/offline",
                JsonSerializer.Serialize(new { deviceId = session.AgentId }),
                cts.Token).ConfigureAwait(false);
            _log?.Invoke($"device offline status={(int)response.StatusCode} agentId={session.AgentId}");
        }
        catch (Exception exception)
        {
            _log?.Invoke($"device offline failed: {exception.GetType().Name}: {exception.Message}");
        }
    }

    private Task<HttpResponseMessage> SendOnceAsync(
        CloudConfig config,
        HttpMethod method,
        string path,
        string? jsonBody,
        string idToken,
        CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(method, config.ServerBaseUrl.TrimEnd('/') + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", idToken);
        if (jsonBody is not null)
        {
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
        }

        return _http.SendAsync(request, cancellationToken);
    }
}
