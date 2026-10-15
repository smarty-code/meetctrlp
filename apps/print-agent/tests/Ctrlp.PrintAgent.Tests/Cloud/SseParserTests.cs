using Ctrlp.PrintAgent.Core.Cloud;

namespace Ctrlp.PrintAgent.Tests.Cloud;

/// <summary>Implementation plan 10.6 #1. The cases are the doorbell spike's parser self-test.</summary>
public class SseParserTests
{
    public static TheoryData<string, string, SseEvent[]> Cases => new()
    {
        { "put", "event: put\ndata: {\"path\":\"/\",\"data\":null}\n\n", [new("put", "{\"path\":\"/\",\"data\":null}")] },
        { "patch with CRLF", "event: patch\r\ndata: {\"path\":\"/\",\"data\":{\"a\":1}}\r\n\r\n", [new("patch", "{\"path\":\"/\",\"data\":{\"a\":1}}")] },
        { "keep-alive", "event: keep-alive\ndata: null\n\n", [new("keep-alive", "null")] },
        { "cancel after a comment", ": hello\nevent: cancel\ndata: \"Permission denied\"\n\n", [new("cancel", "\"Permission denied\"")] },
        { "auth_revoked", "event: auth_revoked\ndata: \"credential is no longer valid\"\n\n", [new("auth_revoked", "\"credential is no longer valid\"")] },
        { "multi-line data", "event: put\ndata: line1\ndata: line2\n\n", [new("put", "line1\nline2")] },
        { "no space after colon", "event:put\ndata:x\n\n", [new("put", "x")] },
        { "bare CR", "event: put\rdata: x\r\r", [new("put", "x")] },
        { "CRLF across two events", "event: put\r\ndata: 1\r\n\r\nevent: patch\r\ndata: 2\r\n\r\n", [new("put", "1"), new("patch", "2")] },
        { "data without event is a message", "data: x\n\n", [new("message", "x")] },
        { "unterminated event dropped", "event: put\ndata: 1", [] },
    };

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Parses(string name, string input, SseEvent[] expected)
    {
        var actual = new List<SseEvent>();
        await foreach (var sse in SseParser.ReadAsync(new StringReader(input), CancellationToken.None))
        {
            actual.Add(sse);
        }

        Assert.True(expected.SequenceEqual(actual), $"{name}: got {string.Join(" | ", actual)}");
    }
}
