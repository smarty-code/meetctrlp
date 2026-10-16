using System.Collections.Concurrent;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core;

public sealed class InMemoryJobStore : IJobStore
{
    private readonly ConcurrentDictionary<string, JobDto> _jobs = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, long> _reportNextAt = new(StringComparer.Ordinal);

    public JobDto Enqueue(EnqueueJobRequest request)
    {
        var copies = request.Copies <= 0 ? 1 : request.Copies;
        var job = new JobDto(
            Id: $"job_{Guid.NewGuid():N}",
            State: JobRunState.Queued.ToString().ToLowerInvariant(),
            PrinterId: request.PrinterId,
            DocumentName: string.IsNullOrWhiteSpace(request.DocumentName)
                ? Path.GetFileName(request.DocumentPath)
                : request.DocumentName,
            Copies: copies,
            CreatedAt: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Error: null,
            CloudJobId: request.CloudJobId,
            PagesTotal: request.PagesTotal,
            DocumentPath: request.DocumentPath,
            CloudOrderId: request.CloudOrderId,
            CloudDocumentId: request.CloudDocumentId,
            LeaseId: request.LeaseId,
            CloudShopId: request.CloudShopId,
            CloudAgentId: request.CloudAgentId);

        _jobs[job.Id] = job;
        return job;
    }

    public JobDto RecordStagingFailure(EnqueueJobRequest request, string reason)
    {
        var job = Enqueue(request with { DocumentPath = null });
        return Update(job.Id, current => Pending(current with
        {
            State = JobRunState.Failed.ToString().ToLowerInvariant(),
            Error = reason,
            ErrorCode = "AGENT_STAGING_FAILED",
            CompletedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        }))!;
    }

    public JobDto? FindCloudJob(string cloudJobId, string leaseId) =>
        _jobs.Values
            .Where(job => job.CloudJobId == cloudJobId && job.LeaseId == leaseId)
            .OrderByDescending(job => job.CreatedAt)
            .FirstOrDefault();

    public IReadOnlyList<JobDto> DueReports(string shopId, string agentId, long nowMs, int limit) =>
        PendingFor(shopId, agentId)
            .Where(job => _reportNextAt.GetValueOrDefault(job.Id) <= nowMs)
            .OrderBy(job => job.CompletedAt ?? job.CreatedAt)
            .Take(limit)
            .ToArray();

    public int CountPendingReports(string shopId, string agentId) => PendingFor(shopId, agentId).Count();

    public long? NextReportAt(string shopId, string agentId)
    {
        var pending = PendingFor(shopId, agentId).ToArray();
        return pending.Length == 0 ? null : pending.Min(job => _reportNextAt.GetValueOrDefault(job.Id));
    }

    public void SetReportState(string id, string state)
    {
        _reportNextAt.TryRemove(id, out _);
        Update(id, job => job with { ReportState = state });
    }

    public void DeferReport(string id, long nextAtMs, string error)
    {
        if (_jobs.TryGetValue(id, out var job) && job.ReportState == ReportStates.Pending)
        {
            _reportNextAt[id] = nextAtMs;
            Update(id, current => current with { ReportAttempts = current.ReportAttempts + 1 });
        }
    }

    private IEnumerable<JobDto> PendingFor(string shopId, string agentId) =>
        _jobs.Values.Where(job =>
            job.ReportState == ReportStates.Pending && job.CloudShopId == shopId && job.CloudAgentId == agentId);

    /// <summary>A finished cloud job always gets its final report queued.</summary>
    private JobDto Pending(JobDto job)
    {
        if (job.CloudJobId is null)
        {
            return job;
        }

        _reportNextAt.TryRemove(job.Id, out _);
        return job with { ReportState = ReportStates.Pending, ReportAttempts = 0 };
    }

    public IReadOnlyList<JobDto> List() =>
        _jobs.Values.OrderByDescending(job => job.CreatedAt).ToArray();

    public JobDto? Get(string id) =>
        _jobs.TryGetValue(id, out var job) ? job : null;

    public JobDto? Cancel(string id)
    {
        if (!_jobs.TryGetValue(id, out var job))
        {
            return null;
        }

        if (job.State is not ("created" or "queued"))
        {
            return job;
        }

        var cancelled = Pending(job with
        {
            State = JobRunState.Cancelled.ToString().ToLowerInvariant(),
            CompletedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        });
        _jobs[id] = cancelled;
        return cancelled;
    }

    public JobDto? ClaimNext(string? shopId, string? agentId)
    {
        var job = _jobs.Values
            .Where(candidate => candidate.State == "queued" && candidate.DocumentPath is not null)
            .Where(candidate => candidate.CloudJobId is null ||
                (shopId is not null && agentId is not null && candidate.CloudShopId == shopId && candidate.CloudAgentId == agentId))
            .OrderBy(candidate => candidate.CreatedAt)
            .FirstOrDefault();
        if (job is null)
        {
            return null;
        }

        var claimed = job with
        {
            State = JobRunState.Printing.ToString().ToLowerInvariant(),
            StartedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };
        _jobs[job.Id] = claimed;
        return claimed;
    }

    public JobDto? Complete(string id, int? spoolerJobId = null) =>
        Update(id, job => Pending(job with
        {
            State = JobRunState.Completed.ToString().ToLowerInvariant(),
            SpoolerJobId = spoolerJobId,
            CompletedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Error = null,
            ErrorCode = null,
        }));

    public JobDto? Fail(string id, string reason) =>
        Update(id, job => Pending(job with
        {
            State = JobRunState.Failed.ToString().ToLowerInvariant(),
            Error = reason,
            ErrorCode = "AGENT_EXECUTION_FAILED",
            CompletedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        }));

    public JobDto? Retry(string id) =>
        Update(id, job => job.State != "failed" || job.DocumentPath is null || job.CloudJobId is not null ? job : job with
        {
            State = JobRunState.Queued.ToString().ToLowerInvariant(),
            Error = null,
            RetryCount = job.RetryCount + 1,
            StartedAt = null,
            CompletedAt = null,
            ErrorCode = null,
            ReportState = ReportStates.None,
            ReportAttempts = 0,
        });

    private JobDto? Update(string id, Func<JobDto, JobDto> update)
    {
        if (!_jobs.TryGetValue(id, out var job))
        {
            return null;
        }

        var next = update(job) with { UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
        _jobs[id] = next;
        return next;
    }
}
