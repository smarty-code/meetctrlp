using System.Diagnostics;
using System.Runtime.InteropServices;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Windows;

public sealed class WinspoolPrinterCatalog : IPrinterCatalog
{
    private readonly Action<string>? _log;

    public WinspoolPrinterCatalog(Action<string>? log = null) => _log = log;

    public IReadOnlyList<PrinterDto> List() => Query("list");

    public IReadOnlyList<PrinterDto> Refresh() => Query("refresh");

    public PrinterDto? Get(string id)
    {
        return Query("get").FirstOrDefault(printer =>
            string.Equals(printer.Id, id, StringComparison.OrdinalIgnoreCase)
            || string.Equals(printer.Name, id, StringComparison.OrdinalIgnoreCase));
    }

    private IReadOnlyList<PrinterDto> Query(string reason)
    {
        var clock = Stopwatch.StartNew();
        _log?.Invoke($"winspool query reason={reason}");
        try
        {
            var task = Task.Run(() => Enumerate(WinspoolNative.PrinterEnumLocal, 4));
            if (!task.Wait(TimeSpan.FromSeconds(5)))
            {
                _log?.Invoke($"winspool query reason={reason} timed out after {clock.ElapsedMilliseconds}ms");
                return Array.Empty<PrinterDto>();
            }

            var printers = task.Result;
            _log?.Invoke($"winspool query reason={reason} count={printers.Count} elapsedMs={clock.ElapsedMilliseconds}");
            return printers;
        }
        catch (Exception ex)
        {
            _log?.Invoke($"winspool query reason={reason} failed after {clock.ElapsedMilliseconds}ms: {ex.Message}");
            return Array.Empty<PrinterDto>();
        }
    }

    private IReadOnlyList<PrinterDto> Enumerate(uint flags, uint level)
    {
        _log?.Invoke($"EnumPrinters flags=0x{flags:X} level={level} probing size");
        WinspoolNative.EnumPrinters(flags, null, level, IntPtr.Zero, 0, out var needed, out _);
        var probeError = Marshal.GetLastWin32Error();
        _log?.Invoke($"EnumPrinters probe needed={needed} lastError={probeError}");
        if (needed == 0)
        {
            return Array.Empty<PrinterDto>();
        }

        var buffer = Marshal.AllocHGlobal((int)needed);
        try
        {
            if (!WinspoolNative.EnumPrinters(flags, null, level, buffer, needed, out needed, out var returned))
            {
                var error = Marshal.GetLastWin32Error();
                _log?.Invoke($"EnumPrinters failed lastError={error} needed={needed}");
                throw new InvalidOperationException($"EnumPrinters failed ({error}).");
            }

            var defaultName = GetDefaultPrinterName();
            var stride = Marshal.SizeOf<WinspoolNative.PrinterInfo4>();
            var printers = new List<PrinterDto>((int)returned);
            for (var i = 0; i < returned; i++)
            {
                var info = Marshal.PtrToStructure<WinspoolNative.PrinterInfo4>(buffer + (i * stride));
                var name = info.PrinterName ?? $"printer-{i}";
                printers.Add(new PrinterDto(
                    Id: name,
                    Name: name,
                    IsDefault: string.Equals(name, defaultName, StringComparison.OrdinalIgnoreCase),
                    Status: "unknown",
                    JobCount: 0,
                    PortName: info.ServerName,
                    DriverName: null,
                    IsShared: (info.Attributes & WinspoolNative.AttributeShared) != 0,
                    SystemName: name,
                    IsWindowsDefault: string.Equals(name, defaultName, StringComparison.OrdinalIgnoreCase)));
                _log?.Invoke(
                    $"EnumPrinters[{i}] name={name} server={info.ServerName ?? "(local)"} attributes=0x{info.Attributes:X}");
            }

            _log?.Invoke(
                $"EnumPrinters returned={returned} names={string.Join(" | ", printers.Select(printer => printer.Name))}");
            return printers;
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private string? GetDefaultPrinterName()
    {
        var size = 0;
        WinspoolNative.GetDefaultPrinter(IntPtr.Zero, ref size);
        if (size <= 0)
        {
            _log?.Invoke("GetDefaultPrinter returned no name");
            return null;
        }

        var buffer = Marshal.AllocHGlobal(size * 2);
        try
        {
            var name = WinspoolNative.GetDefaultPrinter(buffer, ref size)
                ? Marshal.PtrToStringUni(buffer)
                : null;
            _log?.Invoke($"GetDefaultPrinter name={name ?? "(null)"}");
            return name;
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }
}
