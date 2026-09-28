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
}

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
