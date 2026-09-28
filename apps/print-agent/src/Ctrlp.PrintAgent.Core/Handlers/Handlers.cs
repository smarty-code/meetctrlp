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
                throw RpcException.Unauthorized("Invalid agent token.");
            }
        }

        context.IsAuthenticated = true;
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

    protected override PrinterListResponse Handle(object? request, RpcContext context) =>
        new(_runtime.Printers.List());
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

        return _runtime.Printers.Get(request.Id) ?? throw RpcException.PrinterNotFound(request.Id);
    }
}

internal sealed class PrintersRefreshHandler : RpcHandler<object, PrinterListResponse>
{
    private readonly AgentRuntime _runtime;

    public PrintersRefreshHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.PrintersRefresh;

    protected override PrinterListResponse Handle(object? request, RpcContext context) =>
        new(_runtime.Printers.Refresh());
}

internal sealed class JobsEnqueueHandler : RpcHandler<EnqueueJobRequest, JobDto>
{
    private readonly AgentRuntime _runtime;

    public JobsEnqueueHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.JobsEnqueue;

    protected override JobDto Handle(EnqueueJobRequest? request, RpcContext context)
    {
        request ??= new EnqueueJobRequest(null, null, null);
        if (!string.IsNullOrWhiteSpace(request.PrinterId) && _runtime.Printers.Get(request.PrinterId) is null)
        {
            throw RpcException.PrinterNotFound(request.PrinterId);
        }

        return _runtime.Jobs.Enqueue(request);
    }
}

internal sealed class JobsListHandler : RpcHandler<object, JobListResponse>
{
    private readonly AgentRuntime _runtime;

    public JobsListHandler(AgentRuntime runtime) => _runtime = runtime;

    public override string Method => RpcMethods.JobsList;

    protected override JobListResponse Handle(object? request, RpcContext context) =>
        new(_runtime.Jobs.List());
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
