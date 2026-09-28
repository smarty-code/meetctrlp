using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Ipc;

public sealed class RpcContext
{
    public bool IsAuthenticated { get; set; }
    public required string? ExpectedToken { get; init; }
    public required bool AllowAnonymous { get; init; }
}

public interface IRpcHandler
{
    string Method { get; }
    Task<JsonElement> HandleAsync(JsonElement? @params, RpcContext context, CancellationToken cancellationToken);
}

public sealed class RpcDispatcher
{
    private readonly Dictionary<string, IRpcHandler> _handlers = new(StringComparer.Ordinal);

    public void Register(IRpcHandler handler)
    {
        _handlers[handler.Method] = handler;
    }

    public async Task<JsonElement> DispatchAsync(
        string method,
        JsonElement? @params,
        RpcContext context,
        CancellationToken cancellationToken)
    {
        if (method != RpcMethods.Hello && !context.IsAuthenticated && !context.AllowAnonymous)
        {
            throw RpcException.Unauthorized("Call agent.hello first.");
        }

        if (!_handlers.TryGetValue(method, out var handler))
        {
            throw RpcException.MethodNotFound(method);
        }

        return await handler.HandleAsync(@params, context, cancellationToken).ConfigureAwait(false);
    }
}
