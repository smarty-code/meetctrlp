using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>
/// Takes this PC's work from the server (implementation plan 10.4). On a signal (the doorbell's
/// <c>workAt</c>, <c>sync.request</c>, a new session) it calls <c>POST .../agents/{agentId}/sync</c>, which
/// accepts paid orders and hands back claimed jobs with download links; it stages each job and queues
/// it locally, and repeats while the server says <c>more</c>. No timers run while idle: only a failed
/// sync is retried, with backoff, because nothing else would ring again for the same work.
/// </summary>
public sealed class AgentSyncService : ISyncTrigger
{
    private const int MaxRounds = 20;
    internal static readonly TimeSpan MinRetry = TimeSpan.FromSeconds(2);
    internal static readonly TimeSpan MaxRetry = TimeSpan.FromSeconds(60);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly IJobStore _jobs;
    private readonly AgentCloudContext _context;
    private readonly CloudApiClient _api;
    private readonly CloudStatus _status;
    private readonly IReportSignal _reports;
    private readonly string _stagingRoot;
    private readonly HttpClient _download;
    private readonly TimeProvider _time;
    private readonly Action<string>? _log;
    private readonly AsyncSignal _signal = new();

    public AgentSyncService(
        IJobStore jobs,
        AgentCloudContext context,
        CloudApiClient api,
        CloudStatus status,
        IReportSignal reports,
        string stagingRoot,
        HttpClient? download = null,
        TimeProvider? time = null,
        Action<string>? log = null)
    {
        _jobs = jobs;
        _context = context;
        _api = api;
        _status = status;
        _reports = reports;
        _stagingRoot = stagingRoot;
        // Downloads get their own client: a large file must not inherit the API's short timeout.
        _download = download ?? new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
        _time = time ?? TimeProvider.System;
        _log = log;
        _context.SessionRenewed += () => Signal("session");
    }

    /// <summary>Signals coalesce: ten rings before the next sync still make one call.</summary>
    public void Signal(string reason) => _signal.Set();

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var failures = 0;
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                if (failures == 0)
                {
                    await _signal.WaitAsync(cancellationToken).ConfigureAwait(false);
                }
                else
                {
                    await _signal.WaitAsync(Retry(failures), _time, cancellationToken).ConfigureAwait(false);
                }

                await SyncAsync(cancellationToken).ConfigureAwait(false);
                failures = 0;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (TokenInvalidException exception)
            {
                // Nobody can sync until someone signs in again; the new session signals.
                _log?.Invoke($"cloud sync waiting for sign-in: {exception.Message}");
                failures = 0;
            }
            catch (Exception exception)
            {
                failures++;
                _log?.Invoke($"cloud sync failed (attempt {failures}): {exception.GetType().Name}: {exception.Message}");
                _status.SetLastError($"sync: {exception.Message}");
            }
        }
    }

    /// <summary>One sync, repeated while the server reports <c>more</c>. Returns how many jobs were queued.</summary>
    public async Task<int> SyncAsync(CancellationToken cancellationToken)
    {
        var queued = 0;
        for (var round = 0; round < MaxRounds; round++)
        {
            var session = _context.Session;
            if (session is null || _context.Config is null)
            {
                return queued;
            }

            using var response = await _api.SendAsync(
                HttpMethod.Post,
                $"/api/v1/shops/{Uri.EscapeDataString(session.ShopId)}/agents/{Uri.EscapeDataString(session.AgentId)}/sync",
                "{}",
                cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"sync answered {(int)response.StatusCode}", null, response.StatusCode);
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var sync = JsonSerializer.Deserialize<SyncResponse>(body, Json) ?? new SyncResponse(null, null, false);
            foreach (var job in sync.Claimed ?? [])
            {
                if (await TakeAsync(session, job, cancellationToken).ConfigureAwait(false))
                {
                    queued++;
                }
            }

            _status.Update(state => state with { LastSyncAt = _time.GetUtcNow().ToUnixTimeMilliseconds(), LastError = null });
            if (!sync.More)
            {
                break;
            }
        }

        return queued;
    }

    /// <summary>Stages and queues one claimed job. A staging failure is queued as a FAILED report.</summary>
    private async Task<bool> TakeAsync(CloudSession session, SyncJob job, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(job.JobId) || string.IsNullOrWhiteSpace(job.LeaseId))
        {
            return false;
        }

        // A re-delivered job this PC already has (printed, printing, or waiting to report) is never taken twice.
        if (_jobs.FindCloudJob(job.JobId, job.LeaseId) is not null)
        {
            return false;
        }

        var request = new EnqueueJobRequest(
            PrinterId: string.IsNullOrWhiteSpace(job.PrinterSystemName) ? job.PrinterName : job.PrinterSystemName,
            DocumentPath: null,
            DocumentName: string.IsNullOrWhiteSpace(job.DocumentName) ? "document" : job.DocumentName,
            Copies: Copies(job.ResolvedSettings),
            CloudJobId: job.JobId,
            DocumentSha256: job.Download?.Sha256Hash,
            ResolvedSettings: job.ResolvedSettings.ValueKind == JsonValueKind.Undefined ? "{}" : job.ResolvedSettings.GetRawText(),
            // One key per lease: a job the shop retries (new lease) is queued again, a re-delivery is not.
            IdempotencyKey: $"cloud-{job.JobId}-{job.LeaseId}",
            PagesTotal: job.PagesTotal,
            CloudOrderId: job.OrderId,
            CloudDocumentId: job.DocumentId,
            LeaseId: job.LeaseId,
            CloudShopId: session.ShopId,
            CloudAgentId: session.AgentId);

        try
        {
            if (job.Download is null || string.IsNullOrWhiteSpace(job.Download.Url) || string.IsNullOrWhiteSpace(job.Download.Sha256Hash))
            {
                throw new InvalidOperationException("The document is no longer available to download.");
            }

            var path = await StageAsync(job.JobId, job.Download, cancellationToken).ConfigureAwait(false);
            _jobs.Enqueue(request with { DocumentPath = path });
            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            // The job is DISPATCHING on the server. Report it FAILED so the shop can retry or reassign it.
            _log?.Invoke($"cloud job staging failed job={job.JobId}: {exception.GetType().Name}: {exception.Message}");
            _jobs.RecordStagingFailure(request, exception.Message);
            _reports.Signal();
            return false;
        }
    }

    private async Task<string> StageAsync(string jobId, SyncDownload download, CancellationToken cancellationToken)
    {
        var directory = Path.Combine(_stagingRoot, jobId);
        Directory.CreateDirectory(directory);
        var extension = download.MimeType switch
        {
            "image/png" => ".png",
            "image/jpeg" => ".jpg",
            _ => ".pdf",
        };
        var path = Path.Combine(directory, $"document{extension}");

        using (var response = await _download.GetAsync(download.Url, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false))
        {
            response.EnsureSuccessStatusCode();
            await using var source = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            await using var destination = File.Create(path);
            await source.CopyToAsync(destination, cancellationToken).ConfigureAwait(false);
        }

        string actual;
        await using (var staged = File.OpenRead(path))
        {
            actual = Convert.ToHexString(await SHA256.HashDataAsync(staged, cancellationToken).ConfigureAwait(false)).ToLowerInvariant();
        }

        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(actual), Encoding.UTF8.GetBytes(download.Sha256Hash.ToLowerInvariant())))
        {
            File.Delete(path);
            throw new InvalidOperationException("The downloaded document doesn't match its hash.");
        }

        return path;
    }

    private static int Copies(JsonElement settings) =>
        settings.ValueKind == JsonValueKind.Object &&
        settings.TryGetProperty("copies", out var copies) &&
        copies.ValueKind == JsonValueKind.Number &&
        copies.TryGetInt32(out var value)
            ? Math.Max(1, value)
            : 1;

    /// <summary>2 s doubling to 60 s.</summary>
    internal static TimeSpan Retry(int failures) =>
        TimeSpan.FromSeconds(Math.Min(MaxRetry.TotalSeconds, MinRetry.TotalSeconds * Math.Pow(2, Math.Max(0, failures - 1))));

    internal sealed record SyncResponse(IReadOnlyList<string>? Accepted, IReadOnlyList<SyncJob>? Claimed, bool More);

    internal sealed record SyncJob(
        string OrderId,
        string? OrderNumber,
        string JobId,
        string? DocumentId,
        string? DocumentName,
        string LeaseId,
        JsonElement ResolvedSettings,
        string? PrinterId,
        string? PrinterSystemName,
        string? PrinterName,
        int PagesTotal,
        bool Redelivered,
        SyncDownload? Download);

    internal sealed record SyncDownload(string Url, string Sha256Hash, string? MimeType, int PageCount, int ExpiresIn);
}
