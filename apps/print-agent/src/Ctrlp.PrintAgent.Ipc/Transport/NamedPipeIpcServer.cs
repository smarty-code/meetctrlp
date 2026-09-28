using System.IO.Pipes;

namespace Ctrlp.PrintAgent.Ipc;

public sealed class NamedPipeIpcServer
{
    private readonly string _pipeName;
    private readonly RpcDispatcher _dispatcher;
    private readonly string? _token;
    private readonly bool _allowAnonymous;
    private readonly Action<string>? _log;

    public NamedPipeIpcServer(
        string pipeName,
        RpcDispatcher dispatcher,
        string? token,
        bool allowAnonymous = false,
        Action<string>? log = null)
    {
        _pipeName = pipeName;
        _dispatcher = dispatcher;
        _token = token;
        _allowAnonymous = allowAnonymous;
        _log = log;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        _log?.Invoke($"listening on named pipe '{_pipeName}'");

        while (!cancellationToken.IsCancellationRequested)
        {
            using var server = CreatePipe();
            try
            {
                await server.WaitForConnectionAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            _log?.Invoke($"client connected pipe='{_pipeName}'");
            var context = new RpcContext
            {
                ExpectedToken = _token,
                AllowAnonymous = _allowAnonymous,
                IsAuthenticated = _allowAnonymous && string.IsNullOrEmpty(_token),
            };
            var session = new JsonRpcSession(_dispatcher, context, _log);

            try
            {
                await session.RunAsync(server, cancellationToken).ConfigureAwait(false);
            }
            catch (IOException ex)
            {
                _log?.Invoke($"session closed pipe='{_pipeName}': {ex}");
            }
            catch (OperationCanceledException)
            {
                return;
            }

            _log?.Invoke("client disconnected");
        }
    }

    private NamedPipeServerStream CreatePipe()
    {
        return new NamedPipeServerStream(
            _pipeName,
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
    }
}
