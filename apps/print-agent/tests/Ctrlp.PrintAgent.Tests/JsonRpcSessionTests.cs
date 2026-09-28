using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Ipc;

namespace Ctrlp.PrintAgent.Tests;

public class JsonRpcSessionTests
{
    [Fact]
    public async Task HelloAuthenticatesAndPingSucceeds()
    {
        var runtime = CreateRuntime();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });

        var hello = await Send(session, RpcMethods.Hello, """{"token":"secret","client":"test"}""", id: 1);
        Assert.Equal(ProtocolInfo.Version, hello.GetProperty("result").GetProperty("protocolVersion").GetString());

        var ping = await Send(session, RpcMethods.Ping, "{}", id: 2);
        Assert.True(ping.GetProperty("result").GetProperty("ok").GetBoolean());
    }

    [Fact]
    public async Task StoresAndClearsRefreshToken()
    {
        var secrets = new MemorySecretStore();
        var runtime = new AgentRuntime(
            new AgentOptions { PipeName = "test", Token = "secret" },
            new StaticPrinterCatalog(),
            new InMemoryJobStore(),
            secrets);
        runtime.MarkReady();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });

        await Send(session, RpcMethods.Hello, """{"token":"secret"}""", id: 1);
        var set = await Send(session, RpcMethods.SecretsSetRefreshToken, """{"refreshToken":"refresh-1"}""", id: 2);
        Assert.True(set.TryGetProperty("result", out var setResult), set.GetRawText());
        Assert.True(setResult.GetProperty("ok").GetBoolean());
        var stored = await Send(session, RpcMethods.SecretsGetRefreshToken, "{}", id: 3);
        Assert.Equal("refresh-1", stored.GetProperty("result").GetProperty("refreshToken").GetString());
        await Send(session, RpcMethods.SecretsClearRefreshToken, "{}", id: 4);
        var cleared = await Send(session, RpcMethods.SecretsGetRefreshToken, "{}", id: 5);
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("result").GetProperty("refreshToken").ValueKind);
    }

    [Fact]
    public async Task RejectsWrongToken()
    {
        var runtime = CreateRuntime();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });

        var response = await Send(session, RpcMethods.Hello, """{"token":"nope"}""", id: 1);
        Assert.Equal(RpcErrorCodes.Unauthorized, response.GetProperty("error").GetProperty("code").GetInt32());
    }

    [Fact]
    public async Task RequiresHelloBeforeOtherMethods()
    {
        var runtime = CreateRuntime();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });

        var response = await Send(session, RpcMethods.Ping, "{}", id: 1);
        Assert.Equal(RpcErrorCodes.Unauthorized, response.GetProperty("error").GetProperty("code").GetInt32());
    }

    [Fact]
    public async Task ListsPrintersFromCatalog()
    {
        var printers = new StaticPrinterCatalog([
            new PrinterDto("HP LaserJet", "HP LaserJet", true, "online", 0, "USB001", "HP", false),
        ]);
        var runtime = new AgentRuntime(
            new AgentOptions { PipeName = "test", Token = "secret" },
            printers,
            new InMemoryJobStore());
        runtime.MarkReady();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });

        await Send(session, RpcMethods.Hello, """{"token":"secret"}""", id: 1);
        var list = await Send(session, RpcMethods.PrintersList, "{}", id: 2);
        var items = list.GetProperty("result").GetProperty("printers");
        Assert.Equal(1, items.GetArrayLength());
        Assert.Equal("HP LaserJet", items[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task EnqueuesAndListsJobs()
    {
        var runtime = CreateRuntime();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });

        await Send(session, RpcMethods.Hello, """{"token":"secret"}""", id: 1);
        var created = await Send(session, RpcMethods.JobsEnqueue, """{"documentName":"file.pdf","copies":2}""", id: 2);
        var jobId = created.GetProperty("result").GetProperty("id").GetString();
        Assert.False(string.IsNullOrWhiteSpace(jobId));
        Assert.Equal("queued", created.GetProperty("result").GetProperty("state").GetString());

        var list = await Send(session, RpcMethods.JobsList, "{}", id: 3);
        Assert.Equal(1, list.GetProperty("result").GetProperty("jobs").GetArrayLength());
    }

    [Fact]
    public async Task UnknownMethodReturnsJsonRpcError()
    {
        var runtime = CreateRuntime();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = true, IsAuthenticated = true });

        var response = await Send(session, "no.such.method", "{}", id: 9);
        Assert.Equal(RpcErrorCodes.MethodNotFound, response.GetProperty("error").GetProperty("code").GetInt32());
    }

    private static AgentRuntime CreateRuntime()
    {
        var runtime = new AgentRuntime(
            new AgentOptions { PipeName = "test", Token = "secret" },
            new StaticPrinterCatalog(),
            new InMemoryJobStore());
        runtime.MarkReady();
        return runtime;
    }

    private static async Task<JsonElement> Send(JsonRpcSession session, string method, string paramsJson, int id)
    {
        var frame = Encoding.UTF8.GetBytes(
            $$"""{"jsonrpc":"2.0","id":{{id}},"method":"{{method}}","params":{{paramsJson}}}""");
        var response = await session.HandleFrameAsync(frame, CancellationToken.None);
        Assert.NotNull(response);
        using var document = JsonDocument.Parse(response);
        return document.RootElement.Clone();
    }
}
