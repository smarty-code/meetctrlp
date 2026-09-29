using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core;

/// <summary>
/// Pulls only jobs assigned to this machine, stages their documents privately, and
/// mirrors local execution state back to the server. The device credential is scoped
/// to its shop/agent and never appears in SQLite or diagnostic logs.
/// </summary>
public sealed class AgentCloudSynchronizer
{
    private readonly IJobStore _jobs;
    private readonly ISecretStore _secrets;
    private readonly HttpClient _http;
    private readonly string _stagingRoot;
    private readonly Action<string>? _log;

    public AgentCloudSynchronizer(
        IJobStore jobs,
        ISecretStore secrets,
        string stagingRoot,
        HttpClient? http = null,
        Action<string>? log = null)
    {
        _jobs = jobs;
        _secrets = secrets;
        _stagingRoot = stagingRoot;
        _http = http ?? new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        _log = log;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(3));
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await SynchronizeOnceAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                _log?.Invoke($"cloud sync failed: {exception.GetType().Name}: {exception.Message}");
            }
            await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SynchronizeOnceAsync(CancellationToken cancellationToken)
    {
        var credential = _secrets.GetAgentCloudCredential();
        if (credential is null)
        {
            return;
        }
        foreach (var local in _jobs.List().Where(job =>
                     !string.IsNullOrWhiteSpace(job.CloudJobId) &&
                     job.State is "completed" or "failed" or "cancelled"))
        {
            try
            {
                await ReportAsync(local, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception exception)
            {
                _log?.Invoke($"cloud job report failed: {exception.GetType().Name}: {exception.Message}");
            }
        }

        using var response = await SendAsync(
            credential,
            HttpMethod.Get,
            $"/api/v1/shops/{Uri.EscapeDataString(credential.ShopId)}/agents/{Uri.EscapeDataString(credential.AgentId)}/jobs?limit=10",
            null,
            cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            _log?.Invoke($"cloud job poll failed status={(int)response.StatusCode}");
            return;
        }
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
        if (!document.RootElement.TryGetProperty("jobs", out var jobs) || jobs.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (var remote in jobs.EnumerateArray())
        {
            await StageAndEnqueueAsync(credential, remote, cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task ReportAsync(JobDto job, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(job.CloudJobId) || string.IsNullOrWhiteSpace(job.CloudOrderId))
        {
            return;
        }
        var credential = _secrets.GetAgentCloudCredential();
        if (credential is null)
        {
            return;
        }
        var status = job.State.ToUpperInvariant() switch
        {
            "PRINTING" => "PRINTING",
            "COMPLETED" => "COMPLETED",
            "FAILED" => "FAILED",
            "CANCELLED" => "CANCELLED",
            _ => "DISPATCHING",
        };
        var payload = JsonSerializer.Serialize(new
        {
            idempotencyKey = $"agent-state-{job.Id}-{job.UpdatedAt ?? job.CreatedAt}-{status}",
            status,
            pagesPrinted = status == "COMPLETED" ? job.PagesTotal : job.PagesPrinted,
            spoolerJobId = job.SpoolerJobId,
            errorCode = status == "FAILED" ? "AGENT_EXECUTION_FAILED" : null,
            errorMessage = status == "FAILED" ? job.Error : null,
        });
        using var response = await SendAsync(
            credential,
            HttpMethod.Patch,
            $"/api/v1/shops/{Uri.EscapeDataString(credential.ShopId)}/orders/{Uri.EscapeDataString(job.CloudOrderId)}/jobs/{Uri.EscapeDataString(job.CloudJobId)}",
            payload,
            cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            _log?.Invoke($"cloud job report failed status={(int)response.StatusCode}");
            return;
        }

        if (status == "COMPLETED" && !string.IsNullOrWhiteSpace(job.CloudDocumentId))
        {
            using var shred = await SendAsync(
                credential,
                HttpMethod.Post,
                $"/api/v1/shops/{Uri.EscapeDataString(credential.ShopId)}/orders/{Uri.EscapeDataString(job.CloudOrderId!)}/documents/{Uri.EscapeDataString(job.CloudDocumentId)}/shred",
                "{}",
                cancellationToken).ConfigureAwait(false);
            if (!shred.IsSuccessStatusCode)
            {
                _log?.Invoke($"cloud shred acknowledgement failed status={(int)shred.StatusCode}");
            }
        }
    }

    private async Task StageAndEnqueueAsync(
        AgentCloudCredential credential,
        JsonElement remote,
        CancellationToken cancellationToken)
    {
        var jobId = Text(remote, "id");
        var orderId = Text(remote, "orderId");
        var documentId = Text(remote, "documentId");
        if (string.IsNullOrWhiteSpace(jobId) || string.IsNullOrWhiteSpace(orderId) || string.IsNullOrWhiteSpace(documentId))
        {
            return;
        }

        using var claim = await SendAsync(
            credential,
            HttpMethod.Post,
            $"/api/v1/shops/{Uri.EscapeDataString(credential.ShopId)}/orders/{Uri.EscapeDataString(orderId)}/jobs/{Uri.EscapeDataString(jobId)}/claim",
            JsonSerializer.Serialize(new { agentId = credential.AgentId, idempotencyKey = $"agent-claim-{jobId}" }),
            cancellationToken).ConfigureAwait(false);
        if (claim.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            return;
        }
        if (!claim.IsSuccessStatusCode)
        {
            _log?.Invoke($"cloud job claim failed status={(int)claim.StatusCode}");
            return;
        }
        using var claimed = JsonDocument.Parse(await claim.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
        var leaseId = Text(claimed.RootElement, "leaseId");

        using var ticket = await SendAsync(
            credential,
            HttpMethod.Get,
            $"/api/v1/shops/{Uri.EscapeDataString(credential.ShopId)}/orders/{Uri.EscapeDataString(orderId)}/jobs/{Uri.EscapeDataString(jobId)}/document",
            null,
            cancellationToken).ConfigureAwait(false);
        ticket.EnsureSuccessStatusCode();
        using var ticketJson = JsonDocument.Parse(await ticket.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
        var url = Text(ticketJson.RootElement, "url");
        var sha256 = Text(ticketJson.RootElement, "sha256Hash");
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(sha256))
        {
            throw new InvalidOperationException("Agent document ticket is incomplete.");
        }

        var directory = Path.Combine(_stagingRoot, jobId);
        Directory.CreateDirectory(directory);
        var mimeType = Text(ticketJson.RootElement, "mimeType");
        var extension = mimeType == "image/png" ? ".png" : mimeType == "image/jpeg" ? ".jpg" : ".pdf";
        var stagedPath = Path.Combine(directory, $"document{extension}");
        using var download = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        download.EnsureSuccessStatusCode();
        await using (var source = await download.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false))
        await using (var destination = File.Create(stagedPath))
        {
            await source.CopyToAsync(destination, cancellationToken).ConfigureAwait(false);
        }

        await using var staged = File.OpenRead(stagedPath);
        var actualHash = Convert.ToHexString(await SHA256.HashDataAsync(staged, cancellationToken).ConfigureAwait(false))
            .ToLowerInvariant();
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(actualHash), Encoding.UTF8.GetBytes(sha256.ToLowerInvariant())))
        {
            File.Delete(stagedPath);
            throw new InvalidOperationException("Downloaded document hash does not match the assigned job.");
        }

        var settings = remote.TryGetProperty("resolvedSettings", out var resolved) ? resolved.GetRawText() : "{}";
        var copies = remote.TryGetProperty("resolvedSettings", out var settingsElement) &&
            settingsElement.TryGetProperty("copies", out var copiesElement) ? copiesElement.GetInt32() : 1;
        _jobs.Enqueue(new(
            PrinterId: Text(remote, "printerSystemName") ?? Text(remote, "printerName"),
            DocumentPath: stagedPath,
            DocumentName: $"document{extension}",
            Copies: copies,
            CloudJobId: jobId,
            DocumentSha256: sha256,
            ResolvedSettings: settings,
            IdempotencyKey: $"agent-stage-{jobId}",
            PagesTotal: remote.TryGetProperty("pagesTotal", out var pages) ? pages.GetInt32() : 0,
            CloudOrderId: orderId,
            CloudDocumentId: documentId,
            LeaseId: leaseId));
    }

    private Task<HttpResponseMessage> SendAsync(
        AgentCloudCredential credential,
        HttpMethod method,
        string path,
        string? body,
        CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(method, new Uri(new Uri(credential.ServerBaseUrl), path));
        request.Headers.Add("x-ctrlp-agent-key", credential.Credential);
        request.Headers.Add("x-ctrlp-agent-id", credential.AgentId);
        if (body is not null)
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }
        return _http.SendAsync(request, cancellationToken);
    }

    private static string? Text(JsonElement source, string property) =>
        source.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
