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
            Error: null);

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
}
