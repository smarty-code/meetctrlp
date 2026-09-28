using System.Text.Json.Serialization;

namespace Ctrlp.PrintAgent.Contracts;

public enum AgentRunState
{
    Starting,
    Ready,
    Stopping,
}

public enum PrinterRunStatus
{
    Online,
    Offline,
    Printing,
    Paused,
    Error,
    Unknown,
}

public enum JobRunState
{
    Created,
    Queued,
    Printing,
    Completed,
    Failed,
    Cancelled,
}

public sealed record HelloRequest(
    [property: JsonPropertyName("token")] string Token,
    [property: JsonPropertyName("client")] string? Client);

public sealed record HelloResponse(
    [property: JsonPropertyName("protocolVersion")] string ProtocolVersion,
    [property: JsonPropertyName("agentVersion")] string AgentVersion,
    [property: JsonPropertyName("pipeName")] string PipeName);

public sealed record PingResponse(
    [property: JsonPropertyName("ok")] bool Ok,
    [property: JsonPropertyName("ts")] long Ts);

public sealed record AgentStatusDto(
    [property: JsonPropertyName("protocolVersion")] string ProtocolVersion,
    [property: JsonPropertyName("agentVersion")] string AgentVersion,
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("pipeName")] string PipeName,
    [property: JsonPropertyName("uptimeMs")] long UptimeMs,
    [property: JsonPropertyName("printerCount")] int PrinterCount,
    [property: JsonPropertyName("queuedJobs")] int QueuedJobs);

public sealed record PrinterOptionsDto(
    [property: JsonPropertyName("colorModes")] IReadOnlyList<string> ColorModes,
    [property: JsonPropertyName("paperSizes")] IReadOnlyList<string> PaperSizes,
    [property: JsonPropertyName("paperSizeLabels")] IReadOnlyList<string> PaperSizeLabels,
    [property: JsonPropertyName("orientations")] IReadOnlyList<string> Orientations,
    [property: JsonPropertyName("duplexModes")] IReadOnlyList<string> DuplexModes,
    [property: JsonPropertyName("inputTrays")] IReadOnlyList<string> InputTrays,
    [property: JsonPropertyName("printQualities")] IReadOnlyList<string> PrintQualities,
    [property: JsonPropertyName("copiesMin")] int CopiesMin,
    [property: JsonPropertyName("copiesMax")] int CopiesMax,
    [property: JsonPropertyName("currentColorMode")] string? CurrentColorMode,
    [property: JsonPropertyName("currentPaperSize")] string? CurrentPaperSize,
    [property: JsonPropertyName("currentOrientation")] string? CurrentOrientation,
    [property: JsonPropertyName("currentInputTray")] string? CurrentInputTray,
    [property: JsonPropertyName("currentPrintQuality")] string? CurrentPrintQuality,
    [property: JsonPropertyName("currentCopies")] int CurrentCopies,
    [property: JsonPropertyName("raw")] IReadOnlyList<string> Raw)
{
    public static PrinterOptionsDto Empty { get; } = new(
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        1,
        1,
        null,
        null,
        null,
        null,
        null,
        1,
        []);
}

public sealed record PrinterDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("isDefault")] bool IsDefault,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("jobCount")] int JobCount,
    [property: JsonPropertyName("portName")] string? PortName,
    [property: JsonPropertyName("driverName")] string? DriverName,
    [property: JsonPropertyName("isShared")] bool IsShared,
    [property: JsonPropertyName("systemName")] string? SystemName = null,
    [property: JsonPropertyName("statusReason")] string? StatusReason = null,
    [property: JsonPropertyName("isColorCapable")] bool IsColorCapable = false,
    [property: JsonPropertyName("isDuplexCapable")] bool IsDuplexCapable = false,
    [property: JsonPropertyName("supportedPaperSizes")] IReadOnlyList<string>? SupportedPaperSizes = null,
    [property: JsonPropertyName("maximumCopies")] int MaximumCopies = 1,
    [property: JsonPropertyName("isWindowsDefault")] bool IsWindowsDefault = false,
    [property: JsonPropertyName("options")] PrinterOptionsDto? Options = null);

public sealed record PrinterListResponse(
    [property: JsonPropertyName("printers")] IReadOnlyList<PrinterDto> Printers);

public sealed record PrinterGetRequest(
    [property: JsonPropertyName("id")] string Id);

public sealed record EnqueueJobRequest(
    [property: JsonPropertyName("printerId")] string? PrinterId,
    [property: JsonPropertyName("documentPath")] string? DocumentPath,
    [property: JsonPropertyName("documentName")] string? DocumentName,
    [property: JsonPropertyName("copies")] int Copies = 1,
    [property: JsonPropertyName("cloudJobId")] string? CloudJobId = null,
    [property: JsonPropertyName("documentSha256")] string? DocumentSha256 = null,
    [property: JsonPropertyName("resolvedSettings")] string? ResolvedSettings = null,
    [property: JsonPropertyName("idempotencyKey")] string? IdempotencyKey = null,
    [property: JsonPropertyName("pagesTotal")] int PagesTotal = 0);

public sealed record JobDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("printerId")] string? PrinterId,
    [property: JsonPropertyName("documentName")] string? DocumentName,
    [property: JsonPropertyName("copies")] int Copies,
    [property: JsonPropertyName("createdAt")] long CreatedAt,
    [property: JsonPropertyName("error")] string? Error,
    [property: JsonPropertyName("cloudJobId")] string? CloudJobId = null,
    [property: JsonPropertyName("pagesTotal")] int PagesTotal = 0,
    [property: JsonPropertyName("pagesPrinted")] int PagesPrinted = 0,
    [property: JsonPropertyName("retryCount")] int RetryCount = 0,
    [property: JsonPropertyName("spoolerJobId")] int? SpoolerJobId = null,
    [property: JsonPropertyName("updatedAt")] long? UpdatedAt = null,
    [property: JsonPropertyName("startedAt")] long? StartedAt = null,
    [property: JsonPropertyName("completedAt")] long? CompletedAt = null,
    [property: JsonIgnore] string? DocumentPath = null);

public sealed record JobEventDto(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("job")] JobDto Job);

public sealed record JobListResponse(
    [property: JsonPropertyName("jobs")] IReadOnlyList<JobDto> Jobs);

public sealed record JobIdRequest(
    [property: JsonPropertyName("id")] string Id);

public sealed record ShutdownResponse(
    [property: JsonPropertyName("ok")] bool Ok);

public sealed record RefreshTokenRequest(
    [property: JsonPropertyName("refreshToken")] string RefreshToken);

public sealed record RefreshTokenResponse(
    [property: JsonPropertyName("refreshToken")]
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)]
    string? RefreshToken);

public sealed record OkResponse(
    [property: JsonPropertyName("ok")] bool Ok);

public sealed record HostIdentityDto(
    [property: JsonPropertyName("deviceIdentifier")] string DeviceIdentifier,
    [property: JsonPropertyName("hostname")] string Hostname,
    [property: JsonPropertyName("osVersion")] string OsVersion,
    [property: JsonPropertyName("appVersion")] string AppVersion,
    [property: JsonPropertyName("agentVersion")] string AgentVersion);

public sealed record HostTelemetryDto(
    [property: JsonPropertyName("memoryWorkingSetBytes")] long MemoryWorkingSetBytes);
