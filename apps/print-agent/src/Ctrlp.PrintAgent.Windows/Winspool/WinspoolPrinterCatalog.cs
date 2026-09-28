using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Windows;

public sealed class WinspoolPrinterCatalog : IPrinterCatalog
{
    public IReadOnlyList<PrinterDto> List() => Query();

    public IReadOnlyList<PrinterDto> Refresh() => Query();

    public PrinterDto? Get(string id)
    {
        return Query().FirstOrDefault(printer =>
            string.Equals(printer.Id, id, StringComparison.OrdinalIgnoreCase)
            || string.Equals(printer.Name, id, StringComparison.OrdinalIgnoreCase));
    }

    private static IReadOnlyList<PrinterDto> Query()
    {
        var flags = WinspoolNative.PrinterEnumLocal | WinspoolNative.PrinterEnumConnections;
        WinspoolNative.EnumPrinters(flags, null, 2, IntPtr.Zero, 0, out var needed, out _);
        if (needed == 0)
        {
            return Array.Empty<PrinterDto>();
        }

        var buffer = Marshal.AllocHGlobal((int)needed);
        try
        {
            if (!WinspoolNative.EnumPrinters(flags, null, 2, buffer, needed, out needed, out var returned))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "EnumPrinters failed.");
            }

            var defaultName = GetDefaultPrinterName();
            var stride = Marshal.SizeOf<WinspoolNative.PrinterInfo2>();
            var printers = new List<PrinterDto>((int)returned);
            for (var i = 0; i < returned; i++)
            {
                var info = Marshal.PtrToStructure<WinspoolNative.PrinterInfo2>(buffer + (i * stride));
                var name = info.PrinterName ?? $"printer-{i}";
                printers.Add(new PrinterDto(
                    Id: name,
                    Name: name,
                    IsDefault: string.Equals(name, defaultName, StringComparison.OrdinalIgnoreCase),
                    Status: MapStatus(info.Status),
                    JobCount: (int)info.JobCount,
                    PortName: info.PortName,
                    DriverName: info.DriverName,
                    IsShared: (info.Attributes & WinspoolNative.AttributeShared) != 0));
            }

            return printers;
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private static string? GetDefaultPrinterName()
    {
        var size = 0;
        WinspoolNative.GetDefaultPrinter(IntPtr.Zero, ref size);
        if (size <= 0)
        {
            return null;
        }

        var buffer = Marshal.AllocHGlobal(size * 2);
        try
        {
            return WinspoolNative.GetDefaultPrinter(buffer, ref size)
                ? Marshal.PtrToStringUni(buffer)
                : null;
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    private static string MapStatus(uint status)
    {
        if (status == 0)
        {
            return PrinterRunStatus.Online.ToString().ToLowerInvariant();
        }

        if ((status & WinspoolNative.StatusPaused) != 0)
        {
            return PrinterRunStatus.Paused.ToString().ToLowerInvariant();
        }

        if ((status & (WinspoolNative.StatusOffline | WinspoolNative.StatusNotAvailable)) != 0)
        {
            return PrinterRunStatus.Offline.ToString().ToLowerInvariant();
        }

        if ((status & (WinspoolNative.StatusPrinting | WinspoolNative.StatusProcessing | WinspoolNative.StatusIoActive)) != 0)
        {
            return PrinterRunStatus.Printing.ToString().ToLowerInvariant();
        }

        if ((status & (
                WinspoolNative.StatusError
                | WinspoolNative.StatusPaperJam
                | WinspoolNative.StatusPaperOut
                | WinspoolNative.StatusDoorOpen
                | WinspoolNative.StatusNoToner
                | WinspoolNative.StatusUserIntervention)) != 0)
        {
            return PrinterRunStatus.Error.ToString().ToLowerInvariant();
        }

        return PrinterRunStatus.Unknown.ToString().ToLowerInvariant();
    }
}
