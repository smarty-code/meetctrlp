using System.Collections.Concurrent;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core;

public sealed class InMemoryJobStore : IJobStore
{
    private readonly ConcurrentDictionary<string, JobDto> _jobs = new(StringComparer.Ordinal);

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
            LeaseId: request.LeaseId);

        _jobs[job.Id] = job;
        return job;
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

        if (job.State is "completed" or "cancelled")
        {
            return job;
        }

        var cancelled = job with { State = JobRunState.Cancelled.ToString().ToLowerInvariant() };
        _jobs[id] = cancelled;
        return cancelled;
    }

    public JobDto? ClaimNext()
    {
        var job = _jobs.Values
            .Where(candidate => candidate.State == "queued")
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
        Update(id, job => job with
        {
            State = JobRunState.Completed.ToString().ToLowerInvariant(),
            SpoolerJobId = spoolerJobId,
            CompletedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Error = null,
        });

    public JobDto? Fail(string id, string reason) =>
        Update(id, job => job with
        {
            State = JobRunState.Failed.ToString().ToLowerInvariant(),
            Error = reason,
            CompletedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        });

    public JobDto? Retry(string id) =>
        Update(id, job => job with
        {
            State = JobRunState.Queued.ToString().ToLowerInvariant(),
            Error = null,
            RetryCount = job.RetryCount + 1,
            StartedAt = null,
            CompletedAt = null,
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
