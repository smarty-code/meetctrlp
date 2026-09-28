using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core;

public sealed class StaticPrinterCatalog : IPrinterCatalog
{
    private IReadOnlyList<PrinterDto> _printers;

    public StaticPrinterCatalog(IReadOnlyList<PrinterDto>? printers = null)
    {
        _printers = printers ?? Array.Empty<PrinterDto>();
    }

    public IReadOnlyList<PrinterDto> List() => _printers;

    public PrinterDto? Get(string id) =>
        _printers.FirstOrDefault(printer =>
            string.Equals(printer.Id, id, StringComparison.OrdinalIgnoreCase)
            || string.Equals(printer.Name, id, StringComparison.OrdinalIgnoreCase));

    public IReadOnlyList<PrinterDto> Refresh() => _printers;

    public void Replace(IReadOnlyList<PrinterDto> printers) => _printers = printers;
}
