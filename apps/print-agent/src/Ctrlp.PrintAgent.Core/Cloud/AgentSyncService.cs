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

    /// <summary>The server's limits for <c>held</c> (packages/schemas agent-sync.ts): one entry over them 400s the sync.</summary>
    internal const int MaxHeld = 100;
    internal const int MaxIdLength = 80;
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
    private readonly Action<JobEventDto>? _publish;
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
        Action<string>? log = null,
        Action<JobEventDto>? publish = null)
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
        _publish = publish;
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

            // Rebuilt every round: the previous round's revokes and claims changed what this PC holds.
            using var response = await _api.SendAsync(
                HttpMethod.Post,
                $"/api/v1/shops/{Uri.EscapeDataString(session.ShopId)}/agents/{Uri.EscapeDataString(session.AgentId)}/sync",
                JsonSerializer.Serialize(new { held = Held(session) }, Json),
                cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"sync answered {(int)response.StatusCode}", null, response.StatusCode);
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var sync = JsonSerializer.Deserialize<SyncResponse>(body, Json) ?? new SyncResponse(null, null, null, false);
            // Revokes first: a job rescued back onto this PC comes back in `claimed` under a new lease, and its
            // old lease must be gone before the new one is queued. An older server sends no `revoked`.
            foreach (var lease in sync.Revoked ?? [])
            {
                Drop(lease);
            }

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

    /// <summary>
    /// The leases this PC holds and hasn't finished, for the server to check. An id the server's schema would
    /// refuse is left out, so one odd row can't fail every sync.
    /// </summary>
    internal IReadOnlyList<HeldLease> Held(CloudSession session) =>
        _jobs.HeldCloudJobs(session.ShopId, session.AgentId, MaxHeld)
            .Where(job => ValidId(job.CloudOrderId) && ValidId(job.CloudJobId) && ValidId(job.LeaseId))
            .Select(job => new HeldLease(job.CloudOrderId!, job.CloudJobId!, job.LeaseId!))
            .ToArray();

    private static bool ValidId(string? value) => value?.Trim().Length is > 0 and <= MaxIdLength;

    /// <summary>
    /// Drops a revoked lease: a queued job is cancelled and its file deleted; a job already at the spooler
    /// finishes. Neither is reported, since the server would answer lease_mismatch or invalid_state.
    /// </summary>
    private void Drop(SyncRevoked lease)
    {
        if (string.IsNullOrWhiteSpace(lease.JobId) || string.IsNullOrWhiteSpace(lease.LeaseId))
        {
            return;
        }

        var job = _jobs.Revoke(lease.JobId, lease.LeaseId, RevokedMessage(lease.Reason));
        if (job is null)
        {
            return;
        }

        _log?.Invoke($"cloud lease revoked job={lease.JobId} reason={lease.Reason ?? "(none)"} state={job.State}");
        if (job.State == "cancelled")
        {
            StagedDocument.TryDelete(job);
            _publish?.Invoke(new JobEventDto(RpcNotifications.JobCancelled, job));
        }
    }

    internal static string RevokedMessage(string? reason) => reason switch
    {
        "CANCELLED" => "The shop cancelled this job.",
        "RESCUED" => "The shop sent this job again, so this copy won't print.",
        "FINISHED" => "The server already has this job's result.",
        "NOT_FOUND" => "This job no longer exists on the server.",
        _ => "The server took this job back.",
    };

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
            PagesTotal: job.PagesTotal ?? 1,
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

            var path = await StageAsync(job.JobId, job.LeaseId, job.Download, cancellationToken).ConfigureAwait(false);
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

    /// <summary>
    /// Stages at <c>{root}/{jobId}/{leaseId}/document.ext</c>. Each lease has its own file: when the shop retries
    /// a job, the old row finishing (and deleting its file) never takes the new lease's document with it.
    /// </summary>
    internal static string StagingPath(string stagingRoot, string jobId, string leaseId, string? mimeType)
    {
        var extension = mimeType switch
        {
            "image/png" => ".png",
            "image/jpeg" => ".jpg",
            _ => ".pdf",
        };
        return Path.Combine(stagingRoot, PathSegment(jobId), PathSegment(leaseId), $"document{extension}");
    }

    /// <summary>Server ids become folder names; one that could leave the staging folder is refused.</summary>
    private static string PathSegment(string value) =>
        value is "." or ".." || value.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0
            ? throw new InvalidOperationException("The job id can't be used as a folder name.")
            : value;

    private async Task<string> StageAsync(string jobId, string leaseId, SyncDownload download, CancellationToken cancellationToken)
    {
        var path = StagingPath(_stagingRoot, jobId, leaseId, download.MimeType);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        try
        {
            using var response = await _download.GetAsync(download.Url, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            await using var source = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            await using var destination = File.Create(path);
            await source.CopyToAsync(destination, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            // A download cut off halfway leaves a partial file that nothing would print or delete.
            TryDelete(path);
            throw;
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

    private static void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
        }
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

    internal sealed record SyncResponse(
        IReadOnlyList<string>? Accepted,
        IReadOnlyList<SyncJob>? Claimed,
        IReadOnlyList<SyncRevoked>? Revoked,
        bool More);

    /// <summary>One entry of the sync request's <c>held</c>.</summary>
    internal sealed record HeldLease(string OrderId, string JobId, string LeaseId);

    /// <summary>A held lease the server revoked: <c>CANCELLED</c>, <c>RESCUED</c>, <c>FINISHED</c> or <c>NOT_FOUND</c>.</summary>
    internal sealed record SyncRevoked(string? OrderId, string? JobId, string? LeaseId, string? Reason);

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
        // Nullable: a null from the server must not fail the whole sync (and every job in it). Defaults to 1.
        int? PagesTotal,
        bool Redelivered,
        SyncDownload? Download);

    // The agent doesn't read PageCount or ExpiresIn; nullable for the same reason as PagesTotal.
    internal sealed record SyncDownload(string Url, string Sha256Hash, string? MimeType, int? PageCount, int? ExpiresIn);
}
