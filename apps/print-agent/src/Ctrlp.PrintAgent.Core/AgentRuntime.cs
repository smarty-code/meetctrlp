using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Ipc;

namespace Ctrlp.PrintAgent.Core;

public sealed class AgentOptions
{
    public required string PipeName { get; init; }
    public string? Token { get; init; }
    public int? ParentPid { get; init; }
    public bool DevMode { get; init; }
    public string AgentVersion { get; init; } = "0.1.0";
}

public sealed class AgentRuntime
{
    private readonly CancellationTokenSource _shutdown = new();
    private readonly DateTimeOffset _startedAt = DateTimeOffset.UtcNow;
    private int _printerCount;

    public AgentRuntime(
        AgentOptions options,
        IPrinterCatalog printers,
        IJobStore jobs,
        ISecretStore? secrets = null,
        IHostIdentity? host = null)
    {
        Options = options;
        Printers = printers;
        Jobs = jobs;
        Secrets = secrets ?? new MemorySecretStore();
        Host = host ?? new FallbackHostIdentity(options);
        State = AgentRunState.Starting;
    }

    public AgentOptions Options { get; }
    public IPrinterCatalog Printers { get; }
    public IJobStore Jobs { get; }
    public ISecretStore Secrets { get; }
    public IHostIdentity Host { get; }
    public AgentRunState State { get; private set; }
    public CancellationToken ShutdownToken => _shutdown.Token;

    public void MarkReady() => State = AgentRunState.Ready;

    public void RememberPrinterCount(int count) => _printerCount = count;

    public void RequestShutdown()
    {
        State = AgentRunState.Stopping;
        _shutdown.Cancel();
        AgentTrace.Write("agent.shutdown requested");
    }

    public AgentStatusDto Status()
    {
        var jobs = Jobs.List();
        var queued = jobs.Count(job => job.State is "queued" or "created" or "printing");
        AgentTrace.Write(
            $"agent.status state={State} printerCount={_printerCount} jobs={jobs.Count} queued={queued} uptimeMs={(long)(DateTimeOffset.UtcNow - _startedAt).TotalMilliseconds}");
        return new AgentStatusDto(
            ProtocolVersion: ProtocolInfo.Version,
            AgentVersion: Options.AgentVersion,
            State: State.ToString().ToLowerInvariant(),
            PipeName: Options.PipeName,
            UptimeMs: (long)(DateTimeOffset.UtcNow - _startedAt).TotalMilliseconds,
            PrinterCount: _printerCount,
            QueuedJobs: queued);
    }

    public RpcDispatcher CreateDispatcher()
    {
        var dispatcher = new RpcDispatcher();
        dispatcher.Register(new Handlers.HelloHandler(this));
        dispatcher.Register(new Handlers.PingHandler());
        dispatcher.Register(new Handlers.StatusHandler(this));
        dispatcher.Register(new Handlers.ShutdownHandler(this));
        dispatcher.Register(new Handlers.PrintersListHandler(this));
        dispatcher.Register(new Handlers.PrintersGetHandler(this));
        dispatcher.Register(new Handlers.PrintersRefreshHandler(this));
        dispatcher.Register(new Handlers.PrintersTestPageHandler(this));
        dispatcher.Register(new Handlers.JobsEnqueueHandler(this));
        dispatcher.Register(new Handlers.JobsListHandler(this));
        dispatcher.Register(new Handlers.JobsGetHandler(this));
        dispatcher.Register(new Handlers.JobsCancelHandler(this));
        dispatcher.Register(new Handlers.JobsRetryHandler(this));
        dispatcher.Register(new Handlers.SecretsGetHandler(this));
        dispatcher.Register(new Handlers.SecretsSetHandler(this));
        dispatcher.Register(new Handlers.SecretsClearHandler(this));
        dispatcher.Register(new Handlers.SecretsSetAgentCloudCredentialHandler(this));
        dispatcher.Register(new Handlers.SecretsClearAgentCloudCredentialHandler(this));
        dispatcher.Register(new Handlers.HostIdentityHandler(this));
        dispatcher.Register(new Handlers.HostTelemetryHandler(this));
        dispatcher.Register(new Handlers.HostExportLogHandler());
        return dispatcher;
    }
}
