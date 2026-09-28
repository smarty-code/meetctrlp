using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Ipc;

public sealed class JsonRpcSession
{
    private readonly RpcDispatcher _dispatcher;
    private readonly RpcContext _context;
    private readonly Action<string>? _log;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private Stream? _stream;

    public JsonRpcSession(RpcDispatcher dispatcher, RpcContext context, Action<string>? log = null)
    {
        _dispatcher = dispatcher;
        _context = context;
        _log = log;
    }

    public async Task RunAsync(Stream stream, CancellationToken cancellationToken)
    {
        _stream = stream;
        while (!cancellationToken.IsCancellationRequested)
        {
            byte[] payload;
            try
            {
                payload = await LengthPrefixedFrame.ReadAsync(stream, cancellationToken).ConfigureAwait(false);
            }
            catch (EndOfStreamException)
            {
                _log?.Invoke("rpc stream ended");
                return;
            }
            catch (OperationCanceledException)
            {
                _log?.Invoke("rpc session cancelled");
                return;
            }

            _log?.Invoke($"rpc frame recv bytes={payload.Length}");
            var responseBytes = await HandleFrameAsync(payload, cancellationToken).ConfigureAwait(false);
            if (responseBytes is null)
            {
                _log?.Invoke("rpc frame has no response (notification)");
                continue;
            }

            await WriteAsync(responseBytes, cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SendNotificationAsync(string method, object parameters, CancellationToken cancellationToken)
    {
        var stream = _stream ?? throw new InvalidOperationException("RPC session is not connected.");
        var payload = Encode(new
        {
            jsonrpc = ProtocolInfo.JsonRpcVersion,
            method,
            @params = parameters,
        });
        _log?.Invoke($"rpc notification method={method} bytes={payload.Length}");
        await _writeLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await LengthPrefixedFrame.WriteAsync(stream, payload, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    private async Task WriteAsync(byte[] payload, CancellationToken cancellationToken)
    {
        var stream = _stream ?? throw new InvalidOperationException("RPC session is not connected.");
        _log?.Invoke($"rpc frame send bytes={payload.Length}");
        await _writeLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await LengthPrefixedFrame.WriteAsync(stream, payload, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    internal async Task<byte[]?> HandleFrameAsync(byte[] payload, CancellationToken cancellationToken)
    {
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(payload);
        }
        catch (JsonException ex)
        {
            _log?.Invoke($"parse error: {ex.Message}");
            return Encode(Error(null, RpcErrorCodes.ParseError, "Parse error"));
        }

        using (document)
        {
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return Encode(Error(null, RpcErrorCodes.InvalidRequest, "Invalid Request"));
            }

            var jsonrpc = root.TryGetProperty("jsonrpc", out var jsonrpcEl) ? jsonrpcEl.GetString() : null;
            if (jsonrpc != ProtocolInfo.JsonRpcVersion)
            {
                return Encode(Error(GetId(root), RpcErrorCodes.InvalidRequest, "jsonrpc must be 2.0"));
            }

            var hasId = root.TryGetProperty("id", out var idEl) && idEl.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined;
            var method = root.TryGetProperty("method", out var methodEl) ? methodEl.GetString() : null;
            JsonElement? paramsEl = root.TryGetProperty("params", out var p) ? p.Clone() : null;
            var id = hasId ? idEl.Clone() : (JsonElement?)null;
            var idText = hasId ? idEl.GetRawText() : "notify";
            var clock = Stopwatch.StartNew();

            if (string.IsNullOrWhiteSpace(method))
            {
                _log?.Invoke($"rpc invalid id={idText}: method is required");
                return hasId ? Encode(Error(id, RpcErrorCodes.InvalidRequest, "method is required")) : null;
            }

            _log?.Invoke($"rpc begin method={method} id={idText}");
            try
            {
                var result = await _dispatcher.DispatchAsync(method, paramsEl, _context, cancellationToken).ConfigureAwait(false);
                _log?.Invoke($"rpc ok method={method} id={idText} elapsedMs={clock.ElapsedMilliseconds}");
                if (!hasId)
                {
                    return null;
                }

                return Encode(Success(id!.Value, result));
            }
            catch (RpcException ex)
            {
                _log?.Invoke($"rpc error method={method} id={idText} code={ex.Code} message={ex.Message} elapsedMs={clock.ElapsedMilliseconds}");
                return hasId ? Encode(Error(id, ex.Code, ex.Message, ex.ErrorData)) : null;
            }
            catch (Exception ex)
            {
                _log?.Invoke($"rpc fail method={method} id={idText} elapsedMs={clock.ElapsedMilliseconds}: {ex}");
                return hasId
                    ? Encode(Error(id, RpcErrorCodes.InternalError, "Internal error"))
                    : null;
            }
        }
    }

    private static JsonElement? GetId(JsonElement root) =>
        root.TryGetProperty("id", out var id) ? id.Clone() : null;

    private static object Success(JsonElement id, JsonElement result) => new JsonRpcSuccess
    {
        Jsonrpc = ProtocolInfo.JsonRpcVersion,
        Id = id,
        Result = result,
    };

    private static object Error(JsonElement? id, int code, string message, JsonElement? data = null) =>
        new JsonRpcFailure
        {
            Jsonrpc = ProtocolInfo.JsonRpcVersion,
            Id = id,
            Error = new JsonRpcErrorBody
            {
                Code = code,
                Message = message,
                Data = data,
            },
        };

    private static byte[] Encode(object value) =>
        Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value, AgentJson.Options));

    private sealed class JsonRpcSuccess
    {
        [JsonPropertyName("jsonrpc")]
        public required string Jsonrpc { get; init; }

        [JsonPropertyName("id")]
        public JsonElement Id { get; init; }

        [JsonPropertyName("result")]
        public JsonElement Result { get; init; }
    }

    private sealed class JsonRpcFailure
    {
        [JsonPropertyName("jsonrpc")]
        public required string Jsonrpc { get; init; }

        [JsonPropertyName("id")]
        public JsonElement? Id { get; init; }

        [JsonPropertyName("error")]
        public required JsonRpcErrorBody Error { get; init; }
    }

    private sealed class JsonRpcErrorBody
    {
        [JsonPropertyName("code")]
        public required int Code { get; init; }

        [JsonPropertyName("message")]
        public required string Message { get; init; }

        [JsonPropertyName("data")]
        public JsonElement? Data { get; init; }
    }
}
