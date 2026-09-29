using System.Text;

namespace Ctrlp.PrintAgent.Core.Handlers;

internal static class TestPageDocument
{
    public static string Write(string printerName)
    {
        var directory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Ctrlp",
            "PrintAgent",
            "test-pages");
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, $"ctrlp-test-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.pdf");
        File.WriteAllBytes(path, Encode(printerName));
        return path;
    }

    public static string LogPath() =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Ctrlp",
            "PrintAgent",
            "agent.log");

    private static byte[] Encode(string printerName)
    {
        var line = Escape($"CtrlP test page  {printerName}  {DateTimeOffset.Now:yyyy-MM-dd HH:mm}");
        var stream = $"BT /F1 18 Tf 72 760 Td ({line}) Tj ET";
        var objects = new[]
        {
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
            "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
            "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
            $"4 0 obj << /Length {stream.Length} >> stream\n{stream}\nendstream endobj",
            "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        };
        var builder = new StringBuilder();
        builder.Append("%PDF-1.4\n");
        var offsets = new List<int>();
        foreach (var item in objects)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(builder.ToString()));
            builder.Append(item).Append('\n');
        }

        var xref = Encoding.ASCII.GetByteCount(builder.ToString());
        builder.Append("xref\n0 6\n0000000000 65535 f \n");
        foreach (var offset in offsets)
        {
            builder.Append(offset.ToString("D10")).Append(" 00000 n \n");
        }

        builder.Append($"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.ASCII.GetBytes(builder.ToString());
    }

    private static string Escape(string value) =>
        value.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
}
