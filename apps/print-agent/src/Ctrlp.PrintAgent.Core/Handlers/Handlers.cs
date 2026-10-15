using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core.Cloud;
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

internal sealed class PrintersTestPageHandler : RpcHandler<PrinterTestPageRequest, JobDto>
{
    private readonly AgentRuntime _runtime;

    public PrintersTestPageHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.PrintersTestPage;

    protected override JobDto Handle(PrinterTestPageRequest? request, RpcContext context)
    {
        var printerId = request?.PrinterId;
        var printer = string.IsNullOrWhiteSpace(printerId)
            ? _runtime.Printers.List().FirstOrDefault(candidate => candidate.IsDefault) ?? _runtime.Printers.List().FirstOrDefault()
            : _runtime.Printers.Get(printerId);
        if (printer is null)
        {
            throw RpcException.PrinterNotFound(printerId ?? "(default)");
        }

        var path = TestPageDocument.Write(printer.Name);
        AgentTrace.Write($"printers.testPage printerId={printer.Id} copies=1");
        return _runtime.Jobs.Enqueue(new(
            PrinterId: printer.Id,
            DocumentPath: path,
            DocumentName: "CtrlP test page.pdf",
            Copies: 1,
            PagesTotal: 1,
            IdempotencyKey: $"test-page-{printer.Id}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"));
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

// The cloud.* notifications only update in-memory state and hand off to the cloud services: the pipe
// handles frames one after another, so they must return at once.

internal sealed class CloudConfigureHandler : RpcHandler<CloudConfigureRequest, OkResponse>
{
    private readonly AgentCloud _cloud;

    public CloudConfigureHandler(AgentCloud cloud) => _cloud = cloud;

    public override string Method => RpcMethods.CloudConfigure;

    protected override OkResponse Handle(CloudConfigureRequest? request, RpcContext context)
    {
        if (request is null || !Uri.TryCreate(request.ServerBaseUrl, UriKind.Absolute, out _))
        {
            throw RpcException.InvalidParams("serverBaseUrl is required");
        }

        var databaseUrl = request.DatabaseUrl?.Trim().TrimEnd('/') ?? "";
        if (databaseUrl.Length > 0 && !Uri.TryCreate(databaseUrl, UriKind.Absolute, out _))
        {
            throw RpcException.InvalidParams("databaseUrl must be an absolute URL");
        }

        var apiKey = request.FirebaseApiKey?.Trim() ?? "";
        _cloud.Context.Configure(new CloudConfig(request.ServerBaseUrl!.TrimEnd('/'), apiKey, databaseUrl));
        AgentTrace.Write(
            $"cloud.configure server={request.ServerBaseUrl} database={(databaseUrl.Length > 0 ? new Uri(databaseUrl).Host : "(none)")} apiKey={(apiKey.Length > 0 ? "present" : "missing")}");
        _cloud.Status.Republish();
        return new(true);
    }
}

internal sealed class CloudSessionHandler : RpcHandler<CloudSessionRequest, OkResponse>
{
    private readonly AgentCloud _cloud;

    public CloudSessionHandler(AgentCloud cloud) => _cloud = cloud;

    public override string Method => RpcMethods.CloudSession;

    protected override OkResponse Handle(CloudSessionRequest? request, RpcContext context)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.ShopId) || string.IsNullOrWhiteSpace(request.AgentId))
        {
            throw RpcException.InvalidParams("shopId and agentId are required");
        }

        // Seed first, so the doorbell's first connection uses the login's token instead of refreshing.
        if (!string.IsNullOrWhiteSpace(request.IdToken))
        {
            _cloud.Tokens.Seed(
                request.IdToken,
                request.ExpiresAt is { } expiresAt ? DateTimeOffset.FromUnixTimeMilliseconds((long)expiresAt) : null);
        }

        _cloud.Context.SetSession(new CloudSession(request.ShopId, request.AgentId));
        _cloud.Sync.Signal("session");
        _cloud.Status.Republish();
        AgentTrace.Write($"cloud.session shopId={request.ShopId} agentId={request.AgentId} seeded={!string.IsNullOrWhiteSpace(request.IdToken)}");
        return new(true);
    }
}

internal sealed class CloudClearHandler : RpcHandler<object, OkResponse>
{
    private readonly AgentCloud _cloud;

    public CloudClearHandler(AgentCloud cloud) => _cloud = cloud;

    public override string Method => RpcMethods.CloudClear;

    protected override OkResponse Handle(object? request, RpcContext context)
    {
        _cloud.Context.ClearSession();
        _cloud.Tokens.Clear();
        AgentTrace.Write("cloud.clear");
        return new(true);
    }
}

internal sealed class SyncRequestHandler : RpcHandler<object, OkResponse>
{
    private readonly AgentCloud _cloud;

    public SyncRequestHandler(AgentCloud cloud) => _cloud = cloud;

    public override string Method => RpcMethods.SyncRequest;

    protected override OkResponse Handle(object? request, RpcContext context)
    {
        _cloud.Sync.Signal("request");
        return new(true);
    }
}

/// <summary>
/// The UI's bearer token for each API call. The cached token comes back at once; otherwise this waits for the
/// single-flight refresh, up to 10 s. <c>signedIn: false</c> means show the login screen.
/// </summary>
internal sealed class CloudGetIdTokenHandler : IRpcHandler
{
    private static readonly TimeSpan RefreshTimeout = TimeSpan.FromSeconds(10);
    private readonly AgentCloud _cloud;

    public CloudGetIdTokenHandler(AgentCloud cloud) => _cloud = cloud;

    public string Method => RpcMethods.CloudGetIdToken;

    public async Task<JsonElement> HandleAsync(JsonElement? @params, RpcContext context, CancellationToken cancellationToken)
    {
        var request = AgentJson.FromElement<IdTokenRequest>(@params) ?? new IdTokenRequest();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(RefreshTimeout);
        IdTokenSnapshot? token;
        try
        {
            token = await _cloud.Tokens.GetAsync(request.ForceRefresh, timeout.Token).ConfigureAwait(false);
        }
        catch (TokenInvalidException)
        {
            token = null;
        }
        catch (TokenUnavailableException exception)
        {
            throw new RpcException(RpcErrorCodes.NotReady, exception.Message);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new RpcException(RpcErrorCodes.NotReady, "Token refresh timed out.");
        }

        var result = token is null
            ? new IdTokenResult(SignedIn: false)
            : new IdTokenResult(true, token.IdToken, token.ExpiresAt.ToUnixTimeMilliseconds(), token.Claims);
        return AgentJson.ToElement(result);
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

internal sealed class HostExportLogHandler : RpcHandler<ExportLogRequest, ExportLogResponse>
{
    public override string Method => RpcMethods.HostExportLog;

    protected override ExportLogResponse Handle(ExportLogRequest? request, RpcContext context)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.DestinationPath))
        {
            throw RpcException.InvalidParams("destinationPath is required");
        }

        var source = TestPageDocument.LogPath();
        if (!File.Exists(source))
        {
            throw RpcException.Internal("agent log is not available yet");
        }

        var destination = Path.GetFullPath(request.DestinationPath);
        var parent = Path.GetDirectoryName(destination);
        if (!string.IsNullOrWhiteSpace(parent))
        {
            Directory.CreateDirectory(parent);
        }
        using var input = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None);
        input.CopyTo(output);
        AgentTrace.Write($"host.exportLog bytes={input.Length}");
        return new(destination, input.Length);
    }
}
