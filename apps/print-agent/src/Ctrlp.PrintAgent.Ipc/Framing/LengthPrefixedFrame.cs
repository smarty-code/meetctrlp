using System.Buffers.Binary;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Ipc;

public static class LengthPrefixedFrame
{
    public static async Task WriteAsync(Stream stream, ReadOnlyMemory<byte> payload, CancellationToken cancellationToken)
    {
        if (payload.Length > ProtocolInfo.MaxFrameBytes)
        {
            throw new InvalidOperationException($"Frame exceeds {ProtocolInfo.MaxFrameBytes} bytes.");
        }

        var header = new byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(header, payload.Length);
        await stream.WriteAsync(header, cancellationToken).ConfigureAwait(false);
        await stream.WriteAsync(payload, cancellationToken).ConfigureAwait(false);
        await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
    }

    public static async Task<byte[]> ReadAsync(Stream stream, CancellationToken cancellationToken)
    {
        var header = new byte[4];
        await ReadExactAsync(stream, header, cancellationToken).ConfigureAwait(false);
        var length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length < 0 || length > ProtocolInfo.MaxFrameBytes)
        {
            throw new InvalidOperationException("Invalid frame length.");
        }

        var payload = new byte[length];
        await ReadExactAsync(stream, payload, cancellationToken).ConfigureAwait(false);
        return payload;
    }

    private static async Task ReadExactAsync(Stream stream, Memory<byte> buffer, CancellationToken cancellationToken)
    {
        var remaining = buffer;
        while (remaining.Length > 0)
        {
            var read = await stream.ReadAsync(remaining, cancellationToken).ConfigureAwait(false);
            if (read == 0)
            {
                throw new EndOfStreamException();
            }

            remaining = remaining[read..];
        }
    }
}
