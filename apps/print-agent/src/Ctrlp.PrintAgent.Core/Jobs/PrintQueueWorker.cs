using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core;

/// <summary>
/// Claims durable work independently of IPC request handling. A claimed row is either
/// completed by the executor or retained as an actionable failure; startup recovery
/// never re-spools an ambiguous in-flight document.
/// </summary>
public sealed class PrintQueueWorker
{
    private readonly IJobStore _jobs;
    private readonly IPrintExecutor _executor;
    private readonly Action<JobEventDto>? _publish;

    public PrintQueueWorker(IJobStore jobs, IPrintExecutor executor, Action<JobEventDto>? publish = null)
    {
        _jobs = jobs;
        _executor = executor;
        _publish = publish;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        while (!cancellationToken.IsCancellationRequested)
        {
            var job = _jobs.ClaimNext();
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
                        if (result.Succeeded && !string.IsNullOrWhiteSpace(job.DocumentPath))
                        {
                            TryDeleteStagedDocument(job.DocumentPath);
                        }
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
                    }
                    AgentTrace.Write($"queue worker execution failed job={jobId}: {exception.GetType().Name}");
                }

                continue;
            }

            await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private void Publish(string type, JobDto job) => _publish?.Invoke(new JobEventDto(type, job));

    private static void TryDeleteStagedDocument(string path)
    {
        try
        {
            File.Delete(path);
            var directory = Path.GetDirectoryName(path);
            if (!string.IsNullOrWhiteSpace(directory) && Directory.Exists(directory) &&
                !Directory.EnumerateFileSystemEntries(directory).Any())
            {
                Directory.Delete(directory);
            }
        }
        catch (IOException)
        {
            // Retrying a completed cloud job is not required; leave cleanup for startup maintenance.
        }
    }
}
