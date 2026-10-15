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

    /// <summary>The local record of a cloud job with this lease, in any state. A re-delivered job is skipped.</summary>
    JobDto? FindCloudJob(string cloudJobId, string leaseId);

    /// <summary>Records a cloud job that couldn't be staged as failed, with its report pending.</summary>
    JobDto RecordStagingFailure(EnqueueJobRequest request, string reason);

    /// <summary>Pending reports for this shop and agent that are due now, oldest first.</summary>
    IReadOnlyList<JobDto> DueReports(string shopId, string agentId, long nowMs, int limit);

    int CountPendingReports(string shopId, string agentId);

    /// <summary>When the next pending report for this shop and agent becomes due, or null if none.</summary>
    long? NextReportAt(string shopId, string agentId);

    /// <summary>Settles a report: <see cref="ReportStates.Acked"/> or <see cref="ReportStates.Rejected"/>.</summary>
    void SetReportState(string id, string state);

    /// <summary>Keeps a report pending and tries it again at <paramref name="nextAtMs"/>.</summary>
    void DeferReport(string id, long nextAtMs, string error);
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
}

public interface IHostIdentity
{
    HostIdentityDto Read();
    HostTelemetryDto Telemetry();
}
