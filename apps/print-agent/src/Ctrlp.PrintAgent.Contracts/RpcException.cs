using System.Text.Json;

namespace Ctrlp.PrintAgent.Contracts;

public sealed class RpcException : Exception
{
    public int Code { get; }
    public JsonElement? ErrorData { get; }

    public RpcException(int code, string message, JsonElement? data = null)
        : base(message)
    {
        Code = code;
        ErrorData = data;
    }

    public static RpcException MethodNotFound(string method) =>
        new(RpcErrorCodes.MethodNotFound, $"Method not found: {method}");

    public static RpcException InvalidParams(string message) =>
        new(RpcErrorCodes.InvalidParams, message);

    public static RpcException Unauthorized(string message = "Unauthorized") =>
        new(RpcErrorCodes.Unauthorized, message);

    public static RpcException PrinterNotFound(string id) =>
        new(RpcErrorCodes.PrinterNotFound, $"Printer not found: {id}");

    public static RpcException JobNotFound(string id) =>
        new(RpcErrorCodes.JobNotFound, $"Job not found: {id}");

    public static RpcException Internal(string message) =>
        new(RpcErrorCodes.InternalError, message);
}
