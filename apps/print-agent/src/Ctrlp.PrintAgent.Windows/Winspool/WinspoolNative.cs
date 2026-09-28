using System.Runtime.InteropServices;

namespace Ctrlp.PrintAgent.Windows;

internal static class WinspoolNative
{
    public const uint PrinterEnumLocal = 0x00000002;
    public const uint PrinterEnumConnections = 0x00000004;

    public const uint StatusPaused = 0x00000001;
    public const uint StatusError = 0x00000002;
    public const uint StatusPendingDeletion = 0x00000004;
    public const uint StatusPaperJam = 0x00000008;
    public const uint StatusPaperOut = 0x00000010;
    public const uint StatusManualFeed = 0x00000020;
    public const uint StatusPaperProblem = 0x00000040;
    public const uint StatusOffline = 0x00000080;
    public const uint StatusIoActive = 0x00000100;
    public const uint StatusBusy = 0x00000200;
    public const uint StatusPrinting = 0x00000400;
    public const uint StatusOutputBinFull = 0x00000800;
    public const uint StatusNotAvailable = 0x00001000;
    public const uint StatusWaiting = 0x00002000;
    public const uint StatusProcessing = 0x00004000;
    public const uint StatusInitializing = 0x00008000;
    public const uint StatusWarmingUp = 0x00010000;
    public const uint StatusTonerLow = 0x00020000;
    public const uint StatusNoToner = 0x00040000;
    public const uint StatusUserIntervention = 0x00100000;
    public const uint StatusOutOfMemory = 0x00200000;
    public const uint StatusDoorOpen = 0x00400000;

    public const uint AttributeShared = 0x00000008;
    public const uint AttributeNetwork = 0x00000010;
    public const uint AttributeLocal = 0x00000040;
    public const int ErrorInsufficientBuffer = 122;

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool EnumPrinters(
        uint flags,
        string? name,
        uint level,
        IntPtr printerEnum,
        uint cbBuf,
        out uint pcbNeeded,
        out uint pcReturned);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool GetDefaultPrinter(IntPtr buffer, ref int bufferSize);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct PrinterInfo4
    {
        public string? PrinterName;
        public string? ServerName;
        public uint Attributes;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct PrinterInfo2
    {
        public string? ServerName;
        public string? PrinterName;
        public string? ShareName;
        public string? PortName;
        public string? DriverName;
        public string? Comment;
        public string? Location;
        public IntPtr DevMode;
        public string? SepFile;
        public string? PrintProcessor;
        public string? Datatype;
        public string? Parameters;
        public IntPtr SecurityDescriptor;
        public uint Attributes;
        public uint Priority;
        public uint DefaultPriority;
        public uint StartTime;
        public uint UntilTime;
        public uint Status;
        public uint JobCount;
        public uint AveragePpm;
    }
}
