using System.Runtime.CompilerServices;
using System.Text;

namespace Ctrlp.PrintAgent.Core.Cloud;

public readonly record struct SseEvent(string Event, string Data);

/// <summary>
/// Minimal text/event-stream parser: event and data fields, multi-line data, comments, CR/LF/CRLF.
/// Ported from the doorbell spike, where it ran against the real Realtime Database.
/// </summary>
public static class SseParser
{
    public static async IAsyncEnumerable<SseEvent> ReadAsync(
        TextReader reader,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        string? eventName = null;
        var data = new StringBuilder();
        var hasData = false;

        while (true)
        {
            var line = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
            if (line is null)
            {
                yield break; // An unterminated event at EOF is dropped, as the spec says.
            }

            if (line.Length == 0)
            {
                if (eventName is not null || hasData)
                {
                    yield return new SseEvent(eventName ?? "message", data.ToString());
                }

                eventName = null;
                data.Clear();
                hasData = false;
                continue;
            }

            if (line[0] == ':')
            {
                continue;
            }

            var colon = line.IndexOf(':');
            var field = colon < 0 ? line : line[..colon];
            var value = colon < 0 ? "" : line[(colon + 1)..];
            if (value.StartsWith(' '))
            {
                value = value[1..];
            }

            switch (field)
            {
                case "event":
                    eventName = value;
                    break;
                case "data":
                    if (hasData)
                    {
                        data.Append('\n');
                    }

                    data.Append(value);
                    hasData = true;
                    break;
            }
        }
    }
}
