using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Printing;
using Ctrlp.PrintAgent.Contracts;
using Docnet.Core;
using Docnet.Core.Models;

namespace Ctrlp.PrintAgent.Windows;

/// <summary>
/// Renders supported documents into GDI pages and lets the installed Windows driver
/// consume the print settings. It intentionally does not use WritePrinter with raw
/// PDF bytes, because that assumes unsupported printer-language behaviour.
/// </summary>
public sealed class WindowsDocumentPrintExecutor : IPrintExecutor
{
    private readonly IPrinterCatalog _printers;

    public WindowsDocumentPrintExecutor(IPrinterCatalog printers) => _printers = printers;

    public async Task<PrintExecutionResult> ExecuteAsync(JobDto job, CancellationToken cancellationToken)
    {
        var documentPath = job.DocumentPath;
        if (string.IsNullOrWhiteSpace(documentPath) || !File.Exists(documentPath))
        {
            return new(false, Error: "The staged document is unavailable.");
        }
        var printer = string.IsNullOrWhiteSpace(job.PrinterId) ? null : _printers.Get(job.PrinterId);
        var fileTarget = printer is not null &&
            WindowsPrintCatalog.IsFileTargetPrinter(printer.PortName, printer.DriverName, printer.Name);
        var status = printer?.Status?.ToUpperInvariant();
        if (printer is null || (!fileTarget && status is "OFFLINE" or "ERROR" or "PAUSED"))
        {
            return new(false, Error: "The selected Windows printer is unavailable.");
        }

        List<Image> images;
        try
        {
            images = await LoadImagesAsync(documentPath, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            return new(false, Error: exception.Message);
        }
        if (images.Count == 0)
        {
            return new(false, Error: "The staged document has no printable pages.");
        }

        try
        {
            return StaRunner.Run(() => PrintOnSta(printer, job, images, fileTarget), TimeSpan.FromMinutes(2));
        }
        catch (TimeoutException)
        {
            return new(false, Error: "Windows print timed out waiting for the printer driver.");
        }
        catch (Exception exception)
        {
            return new(false, Error: $"Windows print failed: {exception.Message}");
        }
        finally
        {
            foreach (var image in images)
            {
                image.Dispose();
            }
        }
    }

    private static PrintExecutionResult PrintOnSta(
        PrinterDto printer,
        JobDto job,
        List<Image> images,
        bool fileTarget)
    {
        using var document = new PrintDocument();
        document.PrinterSettings.PrinterName = printer.Name;
        if (!document.PrinterSettings.IsValid)
        {
            return new(false, Error: "The selected Windows printer is no longer installed.");
        }
        ApplySettings(document, job);
        document.DocumentName = $"CtrlP {job.Id}";
        if (fileTarget)
        {
            // PORTPROMPT:/FILE: printers (Microsoft Print to PDF, XPS) otherwise show a
            // Save As dialog that blocks the detached agent forever.
            var outputDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Ctrlp",
                "PrintAgent",
                "output");
            Directory.CreateDirectory(outputDir);
            var extension = (printer.DriverName ?? printer.Name ?? "").Contains("XPS", StringComparison.OrdinalIgnoreCase)
                ? ".xps"
                : ".pdf";
            document.PrinterSettings.PrintToFile = true;
            document.PrinterSettings.PrintFileName = Path.Combine(outputDir, $"{job.Id}{extension}");
        }
        var pageIndexes = ResolvePageIndexes(job.ResolvedSettings, images.Count);
        var cursor = 0;
        document.PrintController = new StandardPrintController();
        document.PrintPage += (_, args) =>
        {
            var image = images[pageIndexes[cursor]];
            var bounds = args.MarginBounds.Width > 0 && args.MarginBounds.Height > 0
                ? args.MarginBounds
                : args.PageBounds;
            var ratio = Math.Min((float)bounds.Width / image.Width, (float)bounds.Height / image.Height);
            var width = Math.Max(1, (int)(image.Width * ratio));
            var height = Math.Max(1, (int)(image.Height * ratio));
            var x = bounds.X + (bounds.Width - width) / 2;
            var y = bounds.Y + (bounds.Height - height) / 2;
            args.Graphics?.DrawImage(image, new Rectangle(x, y, width, height));
            cursor++;
            args.HasMorePages = cursor < pageIndexes.Count;
        };
        document.Print();
        return new(true, SpoolerJobId: TryFindSpoolerJobId(printer.Name, document.DocumentName));
    }

    private static int? TryFindSpoolerJobId(string printerName, string documentName)
    {
        try
        {
            return StaRunner.Run(() =>
            {
                using var server = new LocalPrintServer();
                using var queue = new PrintQueue(server, printerName);
                return queue.GetPrintJobInfoCollection()
                    .OrderByDescending(job => job.TimeJobSubmitted)
                    .FirstOrDefault(job => string.Equals(job.Name, documentName, StringComparison.Ordinal))?
                    .JobIdentifier;
            }, TimeSpan.FromSeconds(5));
        }
        catch
        {
            // A driver can immediately consume a job. Printing is still accepted;
            // queue telemetry refreshes on the next printer discovery cycle.
            return null;
        }
    }

    private static Task<List<Image>> LoadImagesAsync(string path, CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(path).ToLowerInvariant();
        if (extension is ".jpg" or ".jpeg" or ".png")
        {
            using var source = Image.FromFile(path);
            return Task.FromResult<List<Image>>([new Bitmap(source)]);
        }
        if (extension == ".pdf")
        {
            return Task.FromResult(RenderPdf(path, cancellationToken));
        }
        throw new InvalidOperationException("Only PDF, JPEG, and PNG documents can be printed.");
    }

    private static List<Image> RenderPdf(string path, CancellationToken cancellationToken)
    {
        // Docnet renders with PDFium into BGRA buffers. The resulting bitmaps are
        // process-local and are disposed by ExecuteAsync after PrintDocument returns.
        using var reader = DocLib.Instance.GetDocReader(path, new PageDimensions(1700, 2200));
        var images = new List<Image>(reader.GetPageCount());
        try
        {
            for (var index = 0; index < reader.GetPageCount(); index++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                using var page = reader.GetPageReader(index);
                var width = page.GetPageWidth();
                var height = page.GetPageHeight();
                var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb);
                var data = bitmap.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.WriteOnly, bitmap.PixelFormat);
                try
                {
                    Marshal.Copy(page.GetImage(), 0, data.Scan0, width * height * 4);
                }
                finally
                {
                    bitmap.UnlockBits(data);
                }
                images.Add(bitmap);
            }
            return images;
        }
        catch
        {
            foreach (var image in images) image.Dispose();
            throw;
        }
    }

    private static void ApplySettings(PrintDocument document, JobDto job)
    {
        using var settings = JsonDocument.Parse(job.ResolvedSettings ?? "{}");
        var root = settings.RootElement;
        if (root.TryGetProperty("copies", out var copies) && copies.TryGetInt32(out var value))
        {
            document.PrinterSettings.Copies = (short)Math.Clamp(value, 1, short.MaxValue);
        }
        if (root.TryGetProperty("colorMode", out var color))
        {
            document.DefaultPageSettings.Color = color.GetString() == "COLOR";
        }
        if (root.TryGetProperty("orientation", out var orientation))
        {
            document.DefaultPageSettings.Landscape = orientation.GetString() == "LANDSCAPE";
        }
        if (root.TryGetProperty("paperSize", out var paper))
        {
            var requested = paper.GetString();
            var match = document.PrinterSettings.PaperSizes
                .Cast<PaperSize>()
                .FirstOrDefault(size => size.PaperName.Contains(requested ?? string.Empty, StringComparison.OrdinalIgnoreCase));
            if (match is not null)
            {
                document.DefaultPageSettings.PaperSize = match;
            }
        }
    }

    private static List<int> ResolvePageIndexes(string? settings, int pageCount)
    {
        using var document = JsonDocument.Parse(settings ?? "{}");
        var selection = document.RootElement.TryGetProperty("pageSelection", out var value)
            ? value.GetString()
            : "all";
        if (string.IsNullOrWhiteSpace(selection) || selection.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return Enumerable.Range(0, pageCount).ToList();
        }
        var selected = new SortedSet<int>();
        foreach (var segment in selection.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var bounds = segment.Split('-', 2, StringSplitOptions.TrimEntries);
            if (!int.TryParse(bounds[0], out var first))
            {
                throw new InvalidOperationException("The requested page selection is invalid.");
            }
            var last = bounds.Length == 2 && int.TryParse(bounds[1], out var end) ? end : first;
            if (first < 1 || last < first || last > pageCount)
            {
                throw new InvalidOperationException("The requested page selection is outside the document.");
            }
            for (var page = first; page <= last; page++)
            {
                selected.Add(page - 1);
            }
        }
        return selected.ToList();
    }
}
