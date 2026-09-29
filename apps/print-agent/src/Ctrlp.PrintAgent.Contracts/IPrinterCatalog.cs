namespace Ctrlp.PrintAgent.Contracts;

public interface IPrinterCatalog
{
    IReadOnlyList<PrinterDto> List();
    PrinterDto? Get(string id);
    IReadOnlyList<PrinterDto> Refresh();
}

public interface IJobStore
{
    JobDto Enqueue(EnqueueJobRequest request);
    IReadOnlyList<JobDto> List();
    JobDto? Get(string id);
    JobDto? Cancel(string id);
    JobDto? ClaimNext();
    JobDto? Complete(string id, int? spoolerJobId = null);
    JobDto? Fail(string id, string reason);
    JobDto? Retry(string id);
}

public interface IJobRepository : IJobStore
{
    void Initialize();
}

public interface IPrintExecutor
{
    Task<PrintExecutionResult> ExecuteAsync(JobDto job, CancellationToken cancellationToken);
}

public sealed record PrintExecutionResult(
    bool Succeeded,
    int? SpoolerJobId = null,
    string? Error = null);

public interface ISecretStore
{
    string? GetRefreshToken();
    void SetRefreshToken(string refreshToken);
    void ClearRefreshToken();
    AgentCloudCredential? GetAgentCloudCredential();
    void SetAgentCloudCredential(AgentCloudCredential credential);
    void ClearAgentCloudCredential();
}

public sealed record AgentCloudCredential(
    string ServerBaseUrl,
    string ShopId,
    string AgentId,
    string Credential);

public interface IHostIdentity
{
    HostIdentityDto Read();
    HostTelemetryDto Telemetry();
}
