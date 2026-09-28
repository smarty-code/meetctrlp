using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Ipc;
using Ctrlp.PrintAgent.Windows;

namespace Ctrlp.PrintAgent.Host;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        var options = AgentCli.Parse(args);
        using var log = AgentLog.Open();
        AgentTrace.Sink = log.Write;
        using var shutdown = new CancellationTokenSource();

        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            shutdown.Cancel();
        };

        IPrinterCatalog printers = OperatingSystem.IsWindows()
            ? new WinspoolPrinterCatalog(log.Write)
            : new StaticPrinterCatalog();
        var runtime = new AgentRuntime(options, printers, new InMemoryJobStore());
        var dispatcher = runtime.CreateDispatcher();
        var server = new NamedPipeIpcServer(
            options.PipeName,
            dispatcher,
            options.Token,
            options.DevMode,
            log.Write);

        if (options.ParentPid is int parentPid)
        {
            _ = ParentProcessWatcher.WatchAsync(parentPid, shutdown, log.Write);
        }

        runtime.MarkReady();
        WriteReady(options);
        log.Write(
            $"ready pid={Environment.ProcessId} pipe={options.PipeName} protocol={ProtocolInfo.Version} log={log.FilePath} parentPid={options.ParentPid?.ToString() ?? "none"} dev={options.DevMode}");

        try
        {
            await server.RunAsync(CancellationTokenSource.CreateLinkedTokenSource(
                shutdown.Token,
                runtime.ShutdownToken).Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
        }

        log.Write("agent stopped");
        return 0;
    }

    private static void WriteReady(AgentOptions options)
    {
        try
        {
            Console.Out.WriteLine($"AGENT_READY pipe={options.PipeName} protocol={ProtocolInfo.Version}");
            Console.Out.Flush();
        }
        catch (IOException)
        {
        }
    }
}
