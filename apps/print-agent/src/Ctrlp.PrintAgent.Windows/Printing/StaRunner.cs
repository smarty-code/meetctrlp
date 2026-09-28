namespace Ctrlp.PrintAgent.Windows;

internal static class StaRunner
{
    public static T Run<T>(Func<T> work, TimeSpan timeout)
    {
        if (Thread.CurrentThread.GetApartmentState() == ApartmentState.STA)
        {
            return work();
        }

        T? result = default;
        Exception? error = null;
        using var done = new ManualResetEventSlim(false);
        var thread = new Thread(() =>
        {
            try
            {
                result = work();
            }
            catch (Exception ex)
            {
                error = ex;
            }
            finally
            {
                done.Set();
            }
        })
        {
            IsBackground = true,
        };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        if (!done.Wait(timeout))
        {
            throw new TimeoutException("Windows print query timed out.");
        }

        if (error is not null)
        {
            throw error;
        }

        return result!;
    }
}
