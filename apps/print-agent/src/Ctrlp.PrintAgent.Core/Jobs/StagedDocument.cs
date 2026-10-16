using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core;

/// <summary>
/// Removes a job's document once nothing will print it again. Cloud documents are staged per lease at
/// <c>jobs/{cloudJobId}/{leaseId}/document.ext</c>, so a job the shop retried (new lease) has its own file
/// and finishing the old row never deletes the new one.
/// </summary>
public static class StagedDocument
{
    /// <summary>
    /// A completed job is done with its file. A failed or cancelled cloud job is too: it can only be retried
    /// from the shop, under a new lease and a new file. A failed local job keeps its file for a local retry.
    /// </summary>
    public static bool IsSpent(JobDto job) => job.State switch
    {
        "completed" => true,
        "failed" or "cancelled" => job.CloudJobId is not null,
        _ => false,
    };

    public static void TryDelete(JobDto job)
    {
        if (string.IsNullOrWhiteSpace(job.DocumentPath) || !IsSpent(job))
        {
            return;
        }

        try
        {
            File.Delete(job.DocumentPath);
            var directory = Path.GetDirectoryName(job.DocumentPath);
            if (!TryRemoveEmpty(directory) || job.CloudJobId is null)
            {
                return;
            }

            // The lease folder is gone; remove the job folder too once its last lease is.
            var parent = Path.GetDirectoryName(directory);
            if (string.Equals(Path.GetFileName(directory), job.LeaseId, StringComparison.Ordinal) &&
                string.Equals(Path.GetFileName(parent), job.CloudJobId, StringComparison.Ordinal))
            {
                TryRemoveEmpty(parent);
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // Best effort: a locked file is left for the next start's sweep.
        }
    }

    /// <summary>Deletes the files of finished cloud jobs left behind by a crash or an older agent.</summary>
    public static void Sweep(IJobStore jobs)
    {
        foreach (var job in jobs.List())
        {
            if (job.CloudJobId is not null && !string.IsNullOrWhiteSpace(job.DocumentPath) && IsSpent(job) &&
                File.Exists(job.DocumentPath))
            {
                TryDelete(job);
            }
        }
    }

    private static bool TryRemoveEmpty(string? directory)
    {
        if (string.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory) ||
            Directory.EnumerateFileSystemEntries(directory).Any())
        {
            return false;
        }

        Directory.Delete(directory);
        return true;
    }
}
