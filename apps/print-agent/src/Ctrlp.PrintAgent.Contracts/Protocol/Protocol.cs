namespace Ctrlp.PrintAgent.Contracts;

public static class ProtocolInfo
{
    public const string JsonRpcVersion = "2.0";
    public const string Version = "1.0.0";
    public const int MaxFrameBytes = 16 * 1024 * 1024;
}

public static class RpcMethods
{
    public const string Hello = "agent.hello";
    public const string Ping = "agent.ping";
    public const string Status = "agent.status";
    public const string Shutdown = "agent.shutdown";

    public const string PrintersList = "printers.list";
    public const string PrintersGet = "printers.get";
    public const string PrintersRefresh = "printers.refresh";

    public const string JobsEnqueue = "jobs.enqueue";
    public const string JobsList = "jobs.list";
    public const string JobsGet = "jobs.get";
    public const string JobsCancel = "jobs.cancel";

    public const string SecretsGetRefreshToken = "secrets.getRefreshToken";
    public const string SecretsSetRefreshToken = "secrets.setRefreshToken";
    public const string SecretsClearRefreshToken = "secrets.clearRefreshToken";
    public const string HostIdentity = "host.identity";
    public const string HostTelemetry = "host.telemetry";
}

public static class RpcNotifications
{
    public const string AgentStatus = "agent.statusChanged";
    public const string AgentError = "agent.error";
    public const string PrinterStatus = "printer.status";
    public const string JobCreated = "job.created";
    public const string JobQueued = "job.queued";
    public const string JobStarted = "job.started";
    public const string JobProgress = "job.progress";
    public const string JobCompleted = "job.completed";
    public const string JobFailed = "job.failed";
    public const string QueueChanged = "queue.changed";
}

public static class RpcErrorCodes
{
    public const int ParseError = -32700;
    public const int InvalidRequest = -32600;
    public const int MethodNotFound = -32601;
    public const int InvalidParams = -32602;
    public const int InternalError = -32603;
    public const int Unauthorized = -32001;
    public const int NotReady = -32002;
    public const int PrinterNotFound = -32010;
    public const int JobNotFound = -32020;
}
