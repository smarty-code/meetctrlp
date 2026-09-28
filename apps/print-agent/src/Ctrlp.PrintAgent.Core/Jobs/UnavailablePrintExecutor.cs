using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core;

/// <summary>
/// Safe fallback for non-Windows/test hosts. It refuses execution rather than sending
/// arbitrary document bytes to a printer transport.
/// </summary>
public sealed class UnavailablePrintExecutor : IPrintExecutor
{
    public Task<PrintExecutionResult> ExecuteAsync(JobDto job, CancellationToken cancellationToken) =>
        Task.FromResult(new PrintExecutionResult(
            Succeeded: false,
            Error: "Windows PDF printing is unavailable on this agent host."));
}
