using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Ipc;

namespace Ctrlp.PrintAgent.Core.Handlers;

internal abstract class RpcHandler<TParams, TResult> : IRpcHandler
{
    public abstract string Method { get; }

    public Task<JsonElement> HandleAsync(JsonElement? @params, RpcContext context, CancellationToken cancellationToken)
    {
        TParams? parsed = default;
        if (typeof(TParams) != typeof(object))
        {
            parsed = AgentJson.FromElement<TParams>(@params);
        }

        var result = Handle(parsed, context);
        return Task.FromResult(AgentJson.ToElement(result));
    }

    protected abstract TResult Handle(TParams? request, RpcContext context);
}

internal sealed class HelloHandler : IRpcHandler
{
    private readonly AgentRuntime _runtime;

    public HelloHandler(AgentRuntime runtime) => _runtime = runtime;

    public string Method => RpcMethods.Hello;

    public Task<JsonElement> HandleAsync(JsonElement? @params, RpcContext context, CancellationToken cancellationToken)
    {
        var request = AgentJson.FromElement<HelloRequest>(@params)
            ?? throw RpcException.InvalidParams("token is required");

        if (string.IsNullOrWhiteSpace(request.Token))
        {
            throw RpcException.InvalidParams("token is required");
        }

        if (!context.AllowAnonymous)
        {
            var expected = context.ExpectedToken ?? string.Empty;
            if (!FixedEquals(expected, request.Token))
            {
                AgentTrace.Write("agent.hello rejected: token mismatch");
                throw RpcException.Unauthorized("Invalid agent token.");
            }
        }

        context.IsAuthenticated = true;
        AgentTrace.Write($"agent.hello ok client={request.Client ?? "(none)"} pipe={_runtime.Options.PipeName}");
        var response = new HelloResponse(
            ProtocolVersion: ProtocolInfo.Version,
            AgentVersion: _runtime.Options.AgentVersion,
            PipeName: _runtime.Options.PipeName);
        return Task.FromResult(AgentJson.ToElement(response));
    }

    private static bool FixedEquals(string expected, string actual)
    {
        var left = Encoding.UTF8.GetBytes(expected);
        var right = Encoding.UTF8.GetBytes(actual);
        if (left.Length != right.Length)
        {
            CryptographicOperations.FixedTimeEquals(left, left);
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(left, right);
    }
}

internal sealed class PingHandler : RpcHandler<object, PingResponse>
{
    public override string Method => RpcMethods.Ping;

    protected override PingResponse Handle(object? request, RpcContext context) =>
        new(true, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
}

internal sealed class StatusHandler : RpcHandler<object, AgentStatusDto>
{
    private readonly AgentRuntime _runtime;

    public StatusHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.Status;

    protected override AgentStatusDto Handle(object? request, RpcContext context) => _runtime.Status();
}

internal sealed class ShutdownHandler : RpcHandler<object, ShutdownResponse>
{
    private readonly AgentRuntime _runtime;

    public ShutdownHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.Shutdown;

    protected override ShutdownResponse Handle(object? request, RpcContext context)
    {
        _runtime.RequestShutdown();
        return new ShutdownResponse(true);
    }
}

internal sealed class PrintersListHandler : RpcHandler<object, PrinterListResponse>
{
    private readonly AgentRuntime _runtime;

    public PrintersListHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.PrintersList;

    protected override PrinterListResponse Handle(object? request, RpcContext context)
    {
        var printers = _runtime.Printers.List();
        _runtime.RememberPrinterCount(printers.Count);
        AgentTrace.Write($"printers.list count={printers.Count}");
        return new(printers);
    }
}

internal sealed class PrintersGetHandler : RpcHandler<PrinterGetRequest, PrinterDto>
{
    private readonly AgentRuntime _runtime;

    public PrintersGetHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.PrintersGet;

    protected override PrinterDto Handle(PrinterGetRequest? request, RpcContext context)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Id))
        {
            throw RpcException.InvalidParams("id is required");
        }

        var printer = _runtime.Printers.Get(request.Id);
        if (printer is null)
        {
            AgentTrace.Write($"printers.get miss id={request.Id}");
            throw RpcException.PrinterNotFound(request.Id);
        }

        AgentTrace.Write($"printers.get hit id={printer.Id}");
        return printer;
    }
}

internal sealed class PrintersRefreshHandler : RpcHandler<object, PrinterListResponse>
{
    private readonly AgentRuntime _runtime;

    public PrintersRefreshHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.PrintersRefresh;

    protected override PrinterListResponse Handle(object? request, RpcContext context)
    {
        var printers = _runtime.Printers.Refresh();
        _runtime.RememberPrinterCount(printers.Count);
        AgentTrace.Write($"printers.refresh count={printers.Count}");
        return new(printers);
    }
}

internal sealed class JobsEnqueueHandler : RpcHandler<EnqueueJobRequest, JobDto>
{
    private readonly AgentRuntime _runtime;

    public JobsEnqueueHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.JobsEnqueue;

    protected override JobDto Handle(EnqueueJobRequest? request, RpcContext context)
    {
        request ??= new EnqueueJobRequest(null, null, null);
        AgentTrace.Write($"jobs.enqueue printerId={request.PrinterId ?? "(default)"} document={request.DocumentName ?? "(none)"} copies={request.Copies}");
        if (!string.IsNullOrWhiteSpace(request.PrinterId) && _runtime.Printers.Get(request.PrinterId) is null)
        {
            AgentTrace.Write($"jobs.enqueue printer not found id={request.PrinterId}");
            throw RpcException.PrinterNotFound(request.PrinterId);
        }

        var job = _runtime.Jobs.Enqueue(request);
        AgentTrace.Write($"jobs.enqueue created id={job.Id} state={job.State}");
        return job;
    }
}

internal sealed class JobsListHandler : RpcHandler<object, JobListResponse>
{
    private readonly AgentRuntime _runtime;

    public JobsListHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.JobsList;

    protected override JobListResponse Handle(object? request, RpcContext context)
    {
        var jobs = _runtime.Jobs.List();
        AgentTrace.Write($"jobs.list count={jobs.Count}");
        return new(jobs);
    }
}

internal sealed class JobsGetHandler : RpcHandler<JobIdRequest, JobDto>
{
    private readonly AgentRuntime _runtime;

    public JobsGetHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.JobsGet;

    protected override JobDto Handle(JobIdRequest? request, RpcContext context)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Id))
        {
            throw RpcException.InvalidParams("id is required");
        }

        return _runtime.Jobs.Get(request.Id) ?? throw RpcException.JobNotFound(request.Id);
    }
}

internal sealed class JobsCancelHandler : RpcHandler<JobIdRequest, JobDto>
{
    private readonly AgentRuntime _runtime;

    public JobsCancelHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.JobsCancel;

    protected override JobDto Handle(JobIdRequest? request, RpcContext context)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Id))
        {
            throw RpcException.InvalidParams("id is required");
        }

        return _runtime.Jobs.Cancel(request.Id) ?? throw RpcException.JobNotFound(request.Id);
    }
}

internal sealed class JobsRetryHandler : RpcHandler<JobIdRequest, JobDto>
{
    private readonly AgentRuntime _runtime;

    public JobsRetryHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.JobsRetry;

    protected override JobDto Handle(JobIdRequest? request, RpcContext context)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Id))
        {
            throw RpcException.InvalidParams("id is required");
        }

        return _runtime.Jobs.Retry(request.Id) ?? throw RpcException.JobNotFound(request.Id);
    }
}

internal sealed class SecretsGetHandler : RpcHandler<object, RefreshTokenResponse>
{
    private readonly AgentRuntime _runtime;

    public SecretsGetHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.SecretsGetRefreshToken;

    protected override RefreshTokenResponse Handle(object? request, RpcContext context)
    {
        var token = _runtime.Secrets.GetRefreshToken();
        AgentTrace.Write($"secrets.getRefreshToken present={token is not null}");
        return new(token);
    }
}

internal sealed class SecretsSetHandler : RpcHandler<RefreshTokenRequest, OkResponse>
{
    private readonly AgentRuntime _runtime;

    public SecretsSetHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.SecretsSetRefreshToken;

    protected override OkResponse Handle(RefreshTokenRequest? request, RpcContext context)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            throw RpcException.InvalidParams("refreshToken is required");
        }

        _runtime.Secrets.SetRefreshToken(request.RefreshToken);
        AgentTrace.Write("secrets.setRefreshToken stored");
        return new(true);
    }
}

internal sealed class SecretsClearHandler : RpcHandler<object, OkResponse>
{
    private readonly AgentRuntime _runtime;

    public SecretsClearHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.SecretsClearRefreshToken;

    protected override OkResponse Handle(object? request, RpcContext context)
    {
        _runtime.Secrets.ClearRefreshToken();
        AgentTrace.Write("secrets.clearRefreshToken");
        return new(true);
    }
}

internal sealed class SecretsSetAgentCloudCredentialHandler : RpcHandler<AgentCloudCredentialRequest, OkResponse>
{
    private readonly AgentRuntime _runtime;

    public SecretsSetAgentCloudCredentialHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.SecretsSetAgentCloudCredential;

    protected override OkResponse Handle(AgentCloudCredentialRequest? request, RpcContext context)
    {
        if (request is null || !Uri.TryCreate(request.ServerBaseUrl, UriKind.Absolute, out _) ||
            string.IsNullOrWhiteSpace(request.ShopId) || string.IsNullOrWhiteSpace(request.AgentId) ||
            string.IsNullOrWhiteSpace(request.Credential))
        {
            throw RpcException.InvalidParams("valid agent cloud credentials are required");
        }

        _runtime.Secrets.SetAgentCloudCredential(new(
            request.ServerBaseUrl.TrimEnd('/'),
            request.ShopId,
            request.AgentId,
            request.Credential));
        AgentTrace.Write($"secrets.setAgentCloudCredential agentId={request.AgentId}");
        return new(true);
    }
}

internal sealed class SecretsClearAgentCloudCredentialHandler : RpcHandler<object, OkResponse>
{
    private readonly AgentRuntime _runtime;

    public SecretsClearAgentCloudCredentialHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.SecretsClearAgentCloudCredential;

    protected override OkResponse Handle(object? request, RpcContext context)
    {
        _runtime.Secrets.ClearAgentCloudCredential();
        AgentTrace.Write("secrets.clearAgentCloudCredential");
        return new(true);
    }
}

internal sealed class HostIdentityHandler : RpcHandler<object, HostIdentityDto>
{
    private readonly AgentRuntime _runtime;

    public HostIdentityHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.HostIdentity;

    protected override HostIdentityDto Handle(object? request, RpcContext context)
    {
        var identity = _runtime.Host.Read();
        AgentTrace.Write(
            $"host.identity hostname={identity.Hostname} os={identity.OsVersion} device={identity.DeviceIdentifier[..Math.Min(12, identity.DeviceIdentifier.Length)]}…");
        return identity;
    }
}

internal sealed class HostTelemetryHandler : RpcHandler<object, HostTelemetryDto>
{
    private readonly AgentRuntime _runtime;

    public HostTelemetryHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.HostTelemetry;

    protected override HostTelemetryDto Handle(object? request, RpcContext context)
    {
        var telemetry = _runtime.Host.Telemetry();
        AgentTrace.Write($"host.telemetry memoryWorkingSetBytes={telemetry.MemoryWorkingSetBytes}");
        return telemetry;
    }
}
