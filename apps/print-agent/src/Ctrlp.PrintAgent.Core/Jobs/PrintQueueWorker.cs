using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core.Cloud;

namespace Ctrlp.PrintAgent.Core;

/// <summary>
/// Claims durable work independently of IPC request handling. A claimed row is either
/// completed by the executor or retained as an actionable failure; startup recovery
/// never re-spools an ambiguous in-flight document. Cloud jobs are claimed only for the
/// signed-in shop and PC, so signing out or switching shops stops the previous shop's work.
/// </summary>
public sealed class PrintQueueWorker
{
    private readonly IJobStore _jobs;
    private readonly IPrintExecutor _executor;
    private readonly Action<JobEventDto>? _publish;
    private readonly AgentCloudContext? _cloud;

    public PrintQueueWorker(
        IJobStore jobs,
        IPrintExecutor executor,
        Action<JobEventDto>? publish = null,
        AgentCloudContext? cloud = null)
    {
        _jobs = jobs;
        _executor = executor;
        _publish = publish;
        _cloud = cloud;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        StagedDocument.Sweep(_jobs);
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        while (!cancellationToken.IsCancellationRequested)
        {
            var job = ClaimNext();
            if (job is not null)
            {
                var jobId = job.Id;
                Publish(RpcNotifications.JobStarted, job);
                AgentTrace.Write($"queue worker claimed job={jobId}");
                try
                {
                    var result = await _executor.ExecuteAsync(job, cancellationToken).ConfigureAwait(false);
                    job = result.Succeeded
                        ? _jobs.Complete(job.Id, result.SpoolerJobId)
                        : _jobs.Fail(job.Id, result.Error ?? "Print execution failed");
                    if (job is not null)
                    {
                        Publish(result.Succeeded ? RpcNotifications.JobCompleted : RpcNotifications.JobFailed, job);
                        StagedDocument.TryDelete(job);
                    }
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception exception)
                {
                    job = _jobs.Fail(jobId, "Print execution failed");
                    if (job is not null)
                    {
                        Publish(RpcNotifications.JobFailed, job);
                        StagedDocument.TryDelete(job);
                    }
                    AgentTrace.Write($"queue worker execution failed job={jobId}: {exception.GetType().Name}");
                }

                continue;
            }

            await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>The next job for the current session; read every time, so a sign-out applies before the next claim.</summary>
    internal JobDto? ClaimNext()
    {
        var session = _cloud?.Session;
        return _jobs.ClaimNext(session?.ShopId, session?.AgentId);
    }

    private void Publish(string type, JobDto job) => _publish?.Invoke(new JobEventDto(type, job));
}
