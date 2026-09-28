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

public sealed record PrinterDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("isDefault")] bool IsDefault,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("jobCount")] int JobCount,
    [property: JsonPropertyName("portName")] string? PortName,
    [property: JsonPropertyName("driverName")] string? DriverName,
    [property: JsonPropertyName("isShared")] bool IsShared);

public sealed record PrinterListResponse(
    [property: JsonPropertyName("printers")] IReadOnlyList<PrinterDto> Printers);

public sealed record PrinterGetRequest(
    [property: JsonPropertyName("id")] string Id);

public sealed record EnqueueJobRequest(
    [property: JsonPropertyName("printerId")] string? PrinterId,
    [property: JsonPropertyName("documentPath")] string? DocumentPath,
    [property: JsonPropertyName("documentName")] string? DocumentName,
    [property: JsonPropertyName("copies")] int Copies = 1);

public sealed record JobDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("printerId")] string? PrinterId,
    [property: JsonPropertyName("documentName")] string? DocumentName,
    [property: JsonPropertyName("copies")] int Copies,
    [property: JsonPropertyName("createdAt")] long CreatedAt,
    [property: JsonPropertyName("error")] string? Error);

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
