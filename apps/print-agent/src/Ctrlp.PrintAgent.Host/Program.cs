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
        using var singleInstance = new Mutex(
            initiallyOwned: true,
            name: @"Local\Ctrlp.PrintAgent",
            createdNew: out var isPrimaryInstance);
        if (!isPrimaryInstance)
        {
            log.Write("agent already running for this Windows user; exiting duplicate process");
            return 0;
        }

        AgentTrace.Sink = log.Write;
        using var shutdown = new CancellationTokenSource();

        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            shutdown.Cancel();
        };

        IPrinterCatalog printers = OperatingSystem.IsWindows()
            ? new WindowsPrintCatalog(log.Write)
            : new StaticPrinterCatalog();
        ISecretStore secrets = OperatingSystem.IsWindows()
            ? new WindowsCredentialStore()
            : new MemorySecretStore();
        IHostIdentity host = OperatingSystem.IsWindows()
            ? new WindowsHostIdentity(options.AgentVersion, options.AgentVersion)
            : new FallbackHostIdentity(options);
        var dataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Ctrlp",
            "PrintAgent");
        var jobs = new SqliteJobStore(Path.Combine(dataRoot, "queue.db"));
        jobs.Initialize();
        var runtime = new AgentRuntime(options, printers, jobs, secrets, host);
        var dispatcher = runtime.CreateDispatcher();
        var server = new NamedPipeIpcServer(
            options.PipeName,
            dispatcher,
            options.Token,
            options.DevMode,
            log.Write);
        var cloud = new AgentCloudSynchronizer(
            jobs,
            secrets,
            Path.Combine(dataRoot, "jobs"),
            log: log.Write);
        var queueWorker = new PrintQueueWorker(
            jobs,
            OperatingSystem.IsWindows() ? new WindowsDocumentPrintExecutor(printers) : new UnavailablePrintExecutor(),
            notification =>
            {
                _ = server.PublishAsync(notification.Type, notification);
                _ = cloud.ReportAsync(notification.Job);
            });

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
            using var lifecycle = CancellationTokenSource.CreateLinkedTokenSource(
                shutdown.Token,
                runtime.ShutdownToken);
            var worker = queueWorker.RunAsync(lifecycle.Token);
            var cloudSync = cloud.RunAsync(lifecycle.Token);
            await server.RunAsync(lifecycle.Token).ConfigureAwait(false);
            lifecycle.Cancel();
            await Task.WhenAll(worker, cloudSync).ConfigureAwait(false);
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
