using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Core.Cloud;
using Ctrlp.PrintAgent.Ipc;
using Ctrlp.PrintAgent.Windows;

namespace Ctrlp.PrintAgent.Host;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        var options = AgentCli.Parse(args);
        using var log = AgentLog.Open();
        using var singleInstance = new Mutex(initiallyOwned: false, name: @"Local\Ctrlp.PrintAgent");
        if (!AcquireSingleInstance(singleInstance))
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
        if (OperatingSystem.IsWindows())
        {
            WindowsCredentialStore.DeleteLegacyAgentCredential();
        }

        // Cloud services come before the dispatcher, which hands them the cloud.* notifications.
        var notifier = new AgentNotifier(log.Write);
        var cloudContext = new AgentCloudContext();
        var cloudStatus = new CloudStatus(notifier);
        var tokens = new FirebaseTokenManager(
            cloudContext,
            secrets,
            cloudStatus,
            new HttpClient(Handler()) { Timeout = Timeout.InfiniteTimeSpan },
            log: log.Write);
        var api = new CloudApiClient(
            cloudContext,
            tokens,
            new HttpClient(Handler()) { Timeout = TimeSpan.FromSeconds(20) },
            log.Write);
        var reports = new ReportOutbox(jobs, cloudContext, api, cloudStatus, log: log.Write);
        var sync = new AgentSyncService(
            jobs,
            cloudContext,
            api,
            cloudStatus,
            reports,
            Path.Combine(dataRoot, "jobs"),
            new HttpClient(Handler()) { Timeout = TimeSpan.FromMinutes(5) },
            log: log.Write,
            // A revoked lease's cancelled row, so the queue screen updates without a reload.
            publish: notification => notifier.Publish(notification.Type, notification));
        var doorbell = new DoorbellClient(
            cloudContext,
            tokens,
            sync,
            notifier,
            cloudStatus,
            new HttpClient(Handler()) { Timeout = Timeout.InfiniteTimeSpan },
            log: log.Write);
        var connectivity = new ConnectivityMonitor(doorbell, log: log.Write);
        var cloud = new AgentCloud(cloudContext, tokens, sync, cloudStatus, reports);

        var runtime = new AgentRuntime(options, printers, jobs, secrets, host, cloud);
        var dispatcher = runtime.CreateDispatcher();
        var server = new NamedPipeIpcServer(
            options.PipeName,
            dispatcher,
            options.Token,
            options.DevMode,
            log.Write);
        notifier.Attach((method, payload) => server.PublishAsync(method, payload));
        var queueWorker = new PrintQueueWorker(
            jobs,
            OperatingSystem.IsWindows() ? new WindowsDocumentPrintExecutor(printers) : new UnavailablePrintExecutor(),
            notification =>
            {
                _ = server.PublishAsync(notification.Type, notification);
                // The store already marked a finished cloud job's report pending; just wake the outbox.
                reports.Signal();
            },
            cloudContext);

        if (options.ParentPid is int parentPid)
        {
            _ = ParentProcessWatcher.WatchAsync(parentPid, shutdown, log.Write);
        }

        runtime.MarkReady();
        WriteReady(options);
        log.Write(
            $"ready pid={Environment.ProcessId} pipe={options.PipeName} protocol={ProtocolInfo.Version} log={log.FilePath} parentPid={options.ParentPid?.ToString() ?? "none"} dev={options.DevMode}");

        using var lifecycle = CancellationTokenSource.CreateLinkedTokenSource(
            shutdown.Token,
            runtime.ShutdownToken);
        var background = new[]
        {
            queueWorker.RunAsync(lifecycle.Token),
            sync.RunAsync(lifecycle.Token),
            reports.RunAsync(lifecycle.Token),
            tokens.RunAsync(lifecycle.Token),
            doorbell.RunAsync(lifecycle.Token),
            connectivity.RunAsync(lifecycle.Token),
        };
        try
        {
            await server.RunAsync(lifecycle.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
        }

        // Shutdown (the parent app exited, or agent.shutdown): close the stream first, then tell the
        // server this PC is offline so routing stops sending its printers work. Pending reports stay in SQLite.
        lifecycle.Cancel();
        try
        {
            await Task.WhenAll(background).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception exception)
        {
            log.Write($"background loop failed during shutdown: {exception}");
        }

        await api.MarkDeviceOfflineAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(false);
        log.Write("agent stopped");
        return 0;
    }

    /// <summary>
    /// The agent of a just-closed app can still be shutting down (closing the stream, marking the PC
    /// offline: about 2 s), so a quick restart waits for it rather than leaving the new app without one.
    /// </summary>
    private static bool AcquireSingleInstance(Mutex mutex)
    {
        try
        {
            return mutex.WaitOne(TimeSpan.FromSeconds(10));
        }
        catch (AbandonedMutexException)
        {
            return true; // the previous agent died without releasing it; it's ours now
        }
    }

    private static SocketsHttpHandler Handler() => new()
    {
        ConnectTimeout = TimeSpan.FromSeconds(15),
        PooledConnectionLifetime = TimeSpan.FromMinutes(10),
        AllowAutoRedirect = true, // Realtime Database may answer 307; the redirect keeps ?auth=.
        MaxAutomaticRedirections = 5,
    };

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
