using System.Diagnostics;

namespace Ctrlp.PrintAgent.Host;

internal static class ParentProcessWatcher
{
    public static async Task WatchAsync(int parentPid, CancellationTokenSource shutdown, Action<string> log)
    {
        try
        {
            using var parent = Process.GetProcessById(parentPid);
            await parent.WaitForExitAsync().ConfigureAwait(false);
            log($"parent process {parentPid} exited");
            shutdown.Cancel();
        }
        catch (ArgumentException)
        {
            log($"parent process {parentPid} is not running");
            shutdown.Cancel();
        }
        catch (Exception ex)
        {
            log($"parent watch failed: {ex.Message}");
        }
    }
}
