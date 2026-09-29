using System.Drawing.Printing;
using System.Printing;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Windows;

public sealed class WindowsPrintCatalog : IPrinterCatalog
{
    private readonly Action<string>? _log;
    private readonly Dictionary<string, PrinterDto> _capabilities = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _gate = new();

    public WindowsPrintCatalog(Action<string>? log = null) => _log = log;

    public IReadOnlyList<PrinterDto> List() => Merge(EnumerateLive("list"));

    public IReadOnlyList<PrinterDto> Refresh()
    {
        var live = EnumerateLive("refresh");
        foreach (var printer in live)
        {
            try
            {
                var detailed = ReadOne(printer.Name, TimeSpan.FromSeconds(4));
                lock (_gate)
                {
                    _capabilities[printer.Name] = detailed;
                }
            }
            catch (Exception ex)
            {
                _log?.Invoke($"capabilities failed name={printer.Name}: {ex.Message}");
                lock (_gate)
                {
                    _capabilities.TryAdd(printer.Name, printer);
                }
            }
        }

        return Merge(live);
    }

    public PrinterDto? Get(string id)
    {
        var live = List();
        var match = live.FirstOrDefault(printer =>
            string.Equals(printer.Id, id, StringComparison.OrdinalIgnoreCase)
            || string.Equals(printer.Name, id, StringComparison.OrdinalIgnoreCase)
            || string.Equals(printer.SystemName, id, StringComparison.OrdinalIgnoreCase));
        if (match is null)
        {
            return null;
        }

        lock (_gate)
        {
            if (_capabilities.ContainsKey(match.Name))
            {
                return match;
            }
        }

        try
        {
            var detailed = ReadOne(match.Name, TimeSpan.FromSeconds(4));
            lock (_gate)
            {
                _capabilities[match.Name] = detailed;
            }

            return Merge([match])[0];
        }
        catch (Exception ex)
        {
            _log?.Invoke($"printers.get capabilities failed id={id}: {ex.Message}");
            return match;
        }
    }

    private IReadOnlyList<PrinterDto> Merge(IReadOnlyList<PrinterDto> live)
    {
        lock (_gate)
        {
            return live.Select(printer =>
            {
                if (!_capabilities.TryGetValue(printer.Name, out var cached))
                {
                    return printer;
                }

                return cached with
                {
                    Status = printer.Status,
                    StatusReason = printer.StatusReason,
                    JobCount = printer.JobCount,
                    IsDefault = printer.IsDefault,
                    IsWindowsDefault = printer.IsWindowsDefault,
                    PortName = printer.PortName ?? cached.PortName,
                    DriverName = printer.DriverName ?? cached.DriverName,
                    IsShared = printer.IsShared,
                };
            }).ToList();
        }
    }

    private IReadOnlyList<PrinterDto> EnumerateLive(string reason)
    {
        _log?.Invoke($"print queues enumerate reason={reason}");
        try
        {
            return StaRunner.Run(() => EnumeratePrintQueues(), TimeSpan.FromSeconds(8));
        }
        catch (Exception ex)
        {
            _log?.Invoke($"print queues enumerate failed: {ex.Message}; falling back to winspool");
            return new WinspoolPrinterCatalog(_log).List();
        }
    }

    private PrinterDto ReadOne(string printerName, TimeSpan timeout) =>
        StaRunner.Run(() => ReadCapabilities(printerName), timeout);

    private IReadOnlyList<PrinterDto> EnumeratePrintQueues()
    {
        using var server = new LocalPrintServer();
        var queues = server.GetPrintQueues([EnumeratedPrintQueueTypes.Local]);
        var defaultName = server.DefaultPrintQueue?.Name;
        var printers = new List<PrinterDto>();
        foreach (var queue in queues)
        {
            using (queue)
            {
                try
                {
                    queue.Refresh();
                }
                catch (PrintQueueException ex)
                {
                    _log?.Invoke($"PrintQueue.Refresh failed name={queue.Name}: {ex.Message}");
                }

                printers.Add(FromQueue(queue, defaultName, includeCapabilities: false));
            }
        }

        _log?.Invoke($"print queues returned={printers.Count}");
        return printers;
    }

    private PrinterDto ReadCapabilities(string printerName)
    {
        using var server = new LocalPrintServer();
        using var queue = new PrintQueue(server, printerName);
        queue.Refresh();
        var dto = FromQueue(queue, server.DefaultPrintQueue?.Name, includeCapabilities: true);
        return OverlayGdi(dto);
    }

    private static PrinterDto FromQueue(PrintQueue queue, string? defaultName, bool includeCapabilities)
    {
        var windowsDefault = string.Equals(queue.Name, defaultName, StringComparison.OrdinalIgnoreCase);
        var status = MapStatus(queue);
        var dto = new PrinterDto(
            Id: queue.Name,
            Name: queue.Name,
            IsDefault: windowsDefault,
            Status: status.Status,
            JobCount: Math.Max(0, queue.NumberOfJobs),
            PortName: Safe(() => queue.QueuePort?.Name),
            DriverName: Safe(() => queue.QueueDriver?.Name),
            IsShared: queue.IsShared,
            SystemName: queue.FullName,
            StatusReason: status.Reason,
            IsWindowsDefault: windowsDefault);

        if (!includeCapabilities)
        {
            return dto;
        }

        PrintCapabilities? caps = null;
        try
        {
            caps = queue.GetPrintCapabilities();
        }
        catch (PrintQueueException)
        {
        }

        var ticket = queue.DefaultPrintTicket;
        var colorModes = MapColors(caps);
        var papers = MapPapers(caps);
        var orientations = MapOrientations(caps);
        var duplexModes = MapDuplex(caps);
        var trays = MapTrays(caps);
        var qualities = MapQualities(caps);
        var copiesMax = Math.Clamp(caps?.MaxCopyCount ?? 1, 1, 999);
        var supported = papers.Mapped.Where(size => size is "A4" or "A3").Distinct().ToList();
        var options = new PrinterOptionsDto(
            ColorModes: colorModes,
            PaperSizes: papers.Mapped,
            PaperSizeLabels: papers.Labels,
            Orientations: orientations,
            DuplexModes: duplexModes,
            InputTrays: trays.Mapped,
            PrintQualities: qualities,
            CopiesMin: 1,
            CopiesMax: copiesMax,
            CurrentColorMode: MapColor(ticket?.OutputColor),
            CurrentPaperSize: MapPaperName(ticket?.PageMediaSize?.PageMediaSizeName, ticket?.PageMediaSize?.Width, ticket?.PageMediaSize?.Height),
            CurrentOrientation: ticket?.PageOrientation == PageOrientation.Landscape ? "LANDSCAPE" : "PORTRAIT",
            CurrentInputTray: MapTray(ticket?.InputBin),
            CurrentPrintQuality: MapQuality(ticket?.PageResolution),
            CurrentCopies: ticket?.CopyCount is int copies and > 0 ? copies : 1,
            Raw: papers.Raw.Concat(trays.Raw).Distinct().ToList());

        return dto with
        {
            IsColorCapable = colorModes.Contains("COLOR"),
            IsDuplexCapable = duplexModes.Any(mode => mode.StartsWith("TWO_SIDED", StringComparison.Ordinal)),
            SupportedPaperSizes = supported,
            MaximumCopies = copiesMax,
            Options = options,
        };
    }

    private static PrinterDto OverlayGdi(PrinterDto printer)
    {
        try
        {
            var settings = new PrinterSettings { PrinterName = printer.Name };
            if (!settings.IsValid)
            {
                return printer;
            }

            var papers = new List<string>();
            var labels = new List<string>();
            var raw = new List<string>();
            foreach (PaperSize paper in settings.PaperSizes)
            {
                raw.Add(paper.PaperName);
                var mapped = MapGdiPaper(paper);
                if (mapped is not null && !papers.Contains(mapped))
                {
                    papers.Add(mapped);
                }

                if (!labels.Contains(paper.PaperName))
                {
                    labels.Add(paper.PaperName);
                }
            }

            var trays = new List<string>();
            foreach (PaperSource source in settings.PaperSources)
            {
                var mapped = MapGdiTray(source);
                if (!trays.Contains(mapped))
                {
                    trays.Add(mapped);
                }
            }

            var options = printer.Options ?? PrinterOptionsDto.Empty;
            var colorModes = options.ColorModes.Count > 0
                ? options.ColorModes
                : settings.SupportsColor ? ["COLOR", "MONOCHROME"] : ["MONOCHROME"];
            var duplexModes = options.DuplexModes.Count > 0
                ? options.DuplexModes
                : settings.CanDuplex ? ["ONE_SIDED", "TWO_SIDED_LONG_EDGE"] : ["ONE_SIDED"];
            var paperSizes = options.PaperSizes.Count > 0 ? options.PaperSizes : papers;
            var supported = (printer.SupportedPaperSizes ?? []).Concat(paperSizes.Where(size => size is "A4" or "A3")).Distinct().ToList();

            return printer with
            {
                IsColorCapable = printer.IsColorCapable || settings.SupportsColor,
                IsDuplexCapable = printer.IsDuplexCapable || settings.CanDuplex,
                SupportedPaperSizes = supported,
                MaximumCopies = Math.Max(printer.MaximumCopies, Math.Clamp(settings.MaximumCopies, 1, 999)),
                Options = options with
                {
                    ColorModes = colorModes,
                    PaperSizes = paperSizes,
                    PaperSizeLabels = options.PaperSizeLabels.Count > 0 ? options.PaperSizeLabels : labels,
                    DuplexModes = duplexModes,
                    InputTrays = options.InputTrays.Count > 0 ? options.InputTrays : trays,
                    CopiesMax = Math.Max(options.CopiesMax, Math.Clamp(settings.MaximumCopies, 1, 999)),
                    Raw = options.Raw.Concat(raw).Distinct().ToList(),
                },
            };
        }
        catch (Exception)
        {
            return printer;
        }
    }

    private static (string Status, string? Reason) MapStatus(PrintQueue queue)
    {
        if (queue.IsOffline || queue.IsNotAvailable)
        {
            return ("OFFLINE", queue.IsOffline ? "Offline" : "Not available");
        }

        if (queue.IsPaperJammed)
        {
            return ("ERROR", "Paper jam");
        }

        if (queue.HasPaperProblem || queue.IsOutOfPaper)
        {
            return ("ERROR", queue.IsOutOfPaper ? "Out of paper" : "Paper problem");
        }

        if (queue.IsDoorOpened)
        {
            return ("ERROR", "Door open");
        }

        if (queue.IsInError || (queue.NeedUserIntervention && !IsFileTargetPort(queue)))
        {
            return ("ERROR", "Printer error");
        }

        if (queue.IsPaused)
        {
            return ("PAUSED", "Paused");
        }

        if (queue.IsPrinting || queue.IsBusy || queue.IsProcessing)
        {
            return ("PRINTING", null);
        }

        return ("ONLINE", null);
    }

    internal static bool IsFileTargetPort(PrintQueue queue) =>
        IsFileTargetPrinter(Safe(() => queue.QueuePort?.Name), Safe(() => queue.QueueDriver?.Name), queue.Name);

    internal static bool IsFileTargetPrinter(string? portName, string? driverName, string? printerName)
    {
        var port = portName ?? string.Empty;
        var driver = driverName ?? string.Empty;
        var name = printerName ?? string.Empty;
        return port.Equals("PORTPROMPT:", StringComparison.OrdinalIgnoreCase)
            || port.Equals("FILE:", StringComparison.OrdinalIgnoreCase)
            || port.StartsWith("FILE", StringComparison.OrdinalIgnoreCase)
            || driver.Contains("Print To PDF", StringComparison.OrdinalIgnoreCase)
            || driver.Contains("XPS Document Writer", StringComparison.OrdinalIgnoreCase)
            || name.Contains("Print to PDF", StringComparison.OrdinalIgnoreCase)
            || name.Contains("XPS Document Writer", StringComparison.OrdinalIgnoreCase);
    }

    private static IReadOnlyList<string> MapColors(PrintCapabilities? caps)
    {
        var modes = new List<string>();
        if (caps?.OutputColorCapability is null)
        {
            return modes;
        }

        foreach (var color in caps.OutputColorCapability)
        {
            var mapped = MapColor(color);
            if (mapped is not null && !modes.Contains(mapped))
            {
                modes.Add(mapped);
            }
        }

        return modes;
    }

    private static string? MapColor(OutputColor? color) => color switch
    {
        OutputColor.Color => "COLOR",
        OutputColor.Grayscale => "GRAYSCALE",
        OutputColor.Monochrome => "MONOCHROME",
        _ => null,
    };

    private static (List<string> Mapped, List<string> Labels, List<string> Raw) MapPapers(PrintCapabilities? caps)
    {
        var mapped = new List<string>();
        var labels = new List<string>();
        var raw = new List<string>();
        if (caps?.PageMediaSizeCapability is null)
        {
            return (mapped, labels, raw);
        }

        foreach (var paper in caps.PageMediaSizeCapability)
        {
            var label = paper.PageMediaSizeName?.ToString() ?? $"{paper.Width}x{paper.Height}";
            raw.Add(label);
            if (!labels.Contains(label))
            {
                labels.Add(label);
            }

            var size = MapPaperName(paper.PageMediaSizeName, paper.Width, paper.Height);
            if (size is not null && !mapped.Contains(size))
            {
                mapped.Add(size);
            }
        }

        return (mapped, labels, raw);
    }

    private static string? MapPaperName(PageMediaSizeName? name, double? width, double? height)
    {
        if (name is PageMediaSizeName.ISOA4)
        {
            return "A4";
        }

        if (name is PageMediaSizeName.ISOA3)
        {
            return "A3";
        }

        if (name is PageMediaSizeName.NorthAmericaLetter)
        {
            return "LETTER";
        }

        if (name is PageMediaSizeName.NorthAmericaLegal)
        {
            return "LEGAL";
        }

        var text = name?.ToString() ?? "";
        if (text.Contains("A4", StringComparison.OrdinalIgnoreCase))
        {
            return "A4";
        }

        if (text.Contains("A3", StringComparison.OrdinalIgnoreCase))
        {
            return "A3";
        }

        if (width is double w && height is double h)
        {
            if (Near(w, 816) && Near(h, 1056) || Near(w, 210000) && Near(h, 297000))
            {
                return "A4";
            }

            if (Near(w, 1122) && Near(h, 1587) || Near(w, 297000) && Near(h, 420000))
            {
                return "A3";
            }
        }

        return null;
    }

    private static bool Near(double value, double target) => Math.Abs(value - target) < target * 0.05;

    private static IReadOnlyList<string> MapOrientations(PrintCapabilities? caps)
    {
        var list = new List<string>();
        if (caps?.PageOrientationCapability is null)
        {
            return ["PORTRAIT"];
        }

        foreach (var orientation in caps.PageOrientationCapability)
        {
            if (orientation == PageOrientation.Landscape && !list.Contains("LANDSCAPE"))
            {
                list.Add("LANDSCAPE");
            }

            if (orientation == PageOrientation.Portrait && !list.Contains("PORTRAIT"))
            {
                list.Add("PORTRAIT");
            }
        }

        return list.Count == 0 ? ["PORTRAIT"] : list;
    }

    private static IReadOnlyList<string> MapDuplex(PrintCapabilities? caps)
    {
        var list = new List<string>();
        if (caps?.DuplexingCapability is null)
        {
            return ["ONE_SIDED"];
        }

        foreach (var duplex in caps.DuplexingCapability)
        {
            var mapped = duplex switch
            {
                Duplexing.OneSided => "ONE_SIDED",
                Duplexing.TwoSidedLongEdge => "TWO_SIDED_LONG_EDGE",
                Duplexing.TwoSidedShortEdge => "TWO_SIDED_SHORT_EDGE",
                _ => null,
            };
            if (mapped is not null && !list.Contains(mapped))
            {
                list.Add(mapped);
            }
        }

        return list.Count == 0 ? ["ONE_SIDED"] : list;
    }

    private static (List<string> Mapped, List<string> Raw) MapTrays(PrintCapabilities? caps)
    {
        var mapped = new List<string> { "AUTO_SELECT" };
        var raw = new List<string>();
        if (caps?.InputBinCapability is null)
        {
            return (mapped, raw);
        }

        foreach (var bin in caps.InputBinCapability)
        {
            raw.Add(bin.ToString());
            var name = MapTray(bin);
            if (!mapped.Contains(name))
            {
                mapped.Add(name);
            }
        }

        return (mapped, raw);
    }

    private static string MapTray(InputBin? bin)
    {
        var text = bin?.ToString() ?? "";
        if (text.Contains("Manual", StringComparison.OrdinalIgnoreCase) || text.Contains("Bypass", StringComparison.OrdinalIgnoreCase))
        {
            return "BYPASS_TRAY";
        }

        if (text.Contains("Auto", StringComparison.OrdinalIgnoreCase))
        {
            return "AUTO_SELECT";
        }

        if (text.Contains("2"))
        {
            return "TRAY_2";
        }

        if (text.Contains("3"))
        {
            return "TRAY_3";
        }

        if (text.Contains("1") || text.Contains("Main", StringComparison.OrdinalIgnoreCase) || text.Contains("Cassette", StringComparison.OrdinalIgnoreCase))
        {
            return "TRAY_1";
        }

        return "MAIN_TRAY";
    }

    private static IReadOnlyList<string> MapQualities(PrintCapabilities? caps)
    {
        var list = new List<string>();
        if (caps?.PageResolutionCapability is null)
        {
            return ["STANDARD_600DPI"];
        }

        foreach (var resolution in caps.PageResolutionCapability)
        {
            var mapped = MapQuality(resolution);
            if (mapped is not null && !list.Contains(mapped))
            {
                list.Add(mapped);
            }
        }

        return list.Count == 0 ? ["STANDARD_600DPI"] : list;
    }

    private static string? MapQuality(PageResolution? resolution)
    {
        var dpi = Math.Max(resolution?.X ?? 0, resolution?.Y ?? 0);
        if (dpi <= 0)
        {
            return null;
        }

        if (dpi <= 300)
        {
            return "DRAFT_300DPI";
        }

        if (dpi <= 600)
        {
            return "STANDARD_600DPI";
        }

        return "HIGH_1200DPI";
    }

    private static string? MapGdiPaper(PaperSize paper)
    {
        var name = paper.PaperName ?? "";
        if (name.Contains("A4", StringComparison.OrdinalIgnoreCase) || (Near(paper.Width, 827) && Near(paper.Height, 1169)))
        {
            return "A4";
        }

        if (name.Contains("A3", StringComparison.OrdinalIgnoreCase) || (Near(paper.Width, 1169) && Near(paper.Height, 1654)))
        {
            return "A3";
        }

        if (name.Contains("Letter", StringComparison.OrdinalIgnoreCase))
        {
            return "LETTER";
        }

        if (name.Contains("Legal", StringComparison.OrdinalIgnoreCase))
        {
            return "LEGAL";
        }

        return null;
    }

    private static string MapGdiTray(PaperSource source)
    {
        var name = source.SourceName ?? "";
        if (name.Contains("Manual", StringComparison.OrdinalIgnoreCase) || name.Contains("Bypass", StringComparison.OrdinalIgnoreCase))
        {
            return "BYPASS_TRAY";
        }

        if (name.Contains("2"))
        {
            return "TRAY_2";
        }

        if (name.Contains("3"))
        {
            return "TRAY_3";
        }

        if (name.Contains("1"))
        {
            return "TRAY_1";
        }

        return "AUTO_SELECT";
    }

    private static T? Safe<T>(Func<T> read)
    {
        try
        {
            return read();
        }
        catch (PrintQueueException)
        {
            return default;
        }
    }
}
