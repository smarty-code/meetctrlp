using System.Text;
using Ctrlp.PrintAgent.Ipc;

namespace Ctrlp.PrintAgent.Tests;

public class LengthPrefixedFrameTests
{
    [Fact]
    public async Task RoundTripsPayload()
    {
        using var stream = new MemoryStream();
        var payload = Encoding.UTF8.GetBytes("{\"jsonrpc\":\"2.0\"}");

        await LengthPrefixedFrame.WriteAsync(stream, payload, CancellationToken.None);
        stream.Position = 0;
        var read = await LengthPrefixedFrame.ReadAsync(stream, CancellationToken.None);

        Assert.Equal(payload, read);
    }

    [Fact]
    public async Task RejectsOversizedFrame()
    {
        using var stream = new MemoryStream();
        var header = BitConverter.GetBytes(int.MaxValue);
        if (!BitConverter.IsLittleEndian)
        {
            Array.Reverse(header);
        }

        await stream.WriteAsync(header);
        stream.Position = 0;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            LengthPrefixedFrame.ReadAsync(stream, CancellationToken.None));
    }
}
