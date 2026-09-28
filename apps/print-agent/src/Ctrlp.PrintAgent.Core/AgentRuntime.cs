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

    public AgentRuntime(AgentOptions options, IPrinterCatalog printers, IJobStore jobs)
    {
        Options = options;
        Printers = printers;
        Jobs = jobs;
        State = AgentRunState.Starting;
    }

    public AgentOptions Options { get; }
    public IPrinterCatalog Printers { get; }
    public IJobStore Jobs { get; }
    public AgentRunState State { get; private set; }
    public CancellationToken ShutdownToken => _shutdown.Token;

    public void MarkReady() => State = AgentRunState.Ready;

    public void RequestShutdown()
    {
        State = AgentRunState.Stopping;
        _shutdown.Cancel();
    }

    public AgentStatusDto Status()
    {
        var printers = Printers.List();
        var jobs = Jobs.List();
        return new AgentStatusDto(
            ProtocolVersion: ProtocolInfo.Version,
            AgentVersion: Options.AgentVersion,
            State: State.ToString().ToLowerInvariant(),
            PipeName: Options.PipeName,
            UptimeMs: (long)(DateTimeOffset.UtcNow - _startedAt).TotalMilliseconds,
            PrinterCount: printers.Count,
            QueuedJobs: jobs.Count(job => job.State is "queued" or "created" or "printing"));
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
        dispatcher.Register(new Handlers.JobsEnqueueHandler(this));
        dispatcher.Register(new Handlers.JobsListHandler(this));
        dispatcher.Register(new Handlers.JobsGetHandler(this));
        dispatcher.Register(new Handlers.JobsCancelHandler(this));
        return dispatcher;
    }
}
