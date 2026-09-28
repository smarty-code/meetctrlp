using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Ipc;

namespace Ctrlp.PrintAgent.Tests;

public class PrinterCatalogTests
{
    [Fact]
    public async Task ListIncludesCapabilityFlags()
    {
        var options = new PrinterOptionsDto(
            ["COLOR", "MONOCHROME"],
            ["A4", "A3"],
            ["ISO A4", "ISO A3"],
            ["PORTRAIT", "LANDSCAPE"],
            ["ONE_SIDED"],
            ["AUTO_SELECT"],
            ["STANDARD_600DPI"],
            1,
            99,
            "COLOR",
            "A4",
            "PORTRAIT",
            "AUTO_SELECT",
            "STANDARD_600DPI",
            1,
            ["ISOA4"]);
        var catalog = new StaticPrinterCatalog([
            new PrinterDto(
                "pdf",
                "Microsoft Print to PDF",
                true,
                "ONLINE",
                0,
                "PORTPROMPT:",
                "Microsoft Print To PDF",
                false,
                "Microsoft Print to PDF",
                null,
                true,
                false,
                ["A4", "A3"],
                99,
                true,
                options),
        ]);
        var runtime = new AgentRuntime(
            new AgentOptions { PipeName = "test", Token = "secret" },
            catalog,
            new InMemoryJobStore());
        runtime.MarkReady();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });

        await Send(session, RpcMethods.Hello, """{"token":"secret"}""", 1);
        var list = await Send(session, RpcMethods.PrintersList, "{}", 2);
        var printer = list.GetProperty("result").GetProperty("printers")[0];
        Assert.True(printer.GetProperty("isColorCapable").GetBoolean());
        Assert.False(printer.GetProperty("isDuplexCapable").GetBoolean());
        Assert.Equal("A4", printer.GetProperty("supportedPaperSizes")[0].GetString());
        Assert.Equal("COLOR", printer.GetProperty("options").GetProperty("colorModes")[0].GetString());

        var fetched = await Send(session, RpcMethods.PrintersGet, """{"id":"Microsoft Print to PDF"}""", 3);
        Assert.Equal("pdf", fetched.GetProperty("result").GetProperty("id").GetString());
    }

    [Fact]
    public async Task RefreshReturnsPartialPrinterWhenCapabilityReadTimesOut()
    {
        var catalog = new TimeoutAwareFakeCatalog(TimeSpan.FromSeconds(8), TimeSpan.FromMilliseconds(20));
        var runtime = new AgentRuntime(
            new AgentOptions { PipeName = "test", Token = "secret" },
            catalog,
            new InMemoryJobStore());
        runtime.MarkReady();
        var session = new JsonRpcSession(
            runtime.CreateDispatcher(),
            new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });

        await Send(session, RpcMethods.Hello, """{"token":"secret"}""", 1);
        var started = DateTime.UtcNow;
        var refresh = await Send(session, RpcMethods.PrintersRefresh, "{}", 2);
        Assert.True(DateTime.UtcNow - started < TimeSpan.FromSeconds(2));
        var printer = refresh.GetProperty("result").GetProperty("printers")[0];
        Assert.Equal("Stuck Queue", printer.GetProperty("name").GetString());
        Assert.False(printer.GetProperty("isColorCapable").GetBoolean());
    }

    private static async Task<System.Text.Json.JsonElement> Send(JsonRpcSession session, string method, string paramsJson, int id)
    {
        var frame = System.Text.Encoding.UTF8.GetBytes(
            $$"""{"jsonrpc":"2.0","id":{{id}},"method":"{{method}}","params":{{paramsJson}}}""");
        var response = await session.HandleFrameAsync(frame, CancellationToken.None);
        Assert.NotNull(response);
        using var document = System.Text.Json.JsonDocument.Parse(response);
        return document.RootElement.Clone();
    }
}

internal sealed class TimeoutAwareFakeCatalog : IPrinterCatalog
{
    private readonly TimeSpan _work;
    private readonly TimeSpan _budget;
    private readonly PrinterDto _identity = new(
        "stuck",
        "Stuck Queue",
        false,
        "ONLINE",
        0,
        "USB001",
        "Generic",
        false);

    public TimeoutAwareFakeCatalog(TimeSpan work, TimeSpan budget)
    {
        _work = work;
        _budget = budget;
    }

    public IReadOnlyList<PrinterDto> List() => [_identity];

    public PrinterDto? Get(string id) =>
        string.Equals(id, _identity.Id, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(id, _identity.Name, StringComparison.OrdinalIgnoreCase)
            ? _identity
            : null;

    public IReadOnlyList<PrinterDto> Refresh()
    {
        if (_work > _budget)
        {
            return [_identity];
        }

        Thread.Sleep(_work);
        return [_identity with { IsColorCapable = true }];
    }
}
