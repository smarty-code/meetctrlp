using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core;

public sealed class MemorySecretStore : ISecretStore
{
    private readonly object _gate = new();
    private string? _refreshToken;

    public string? GetRefreshToken()
    {
        lock (_gate)
        {
            return _refreshToken;
        }
    }

    public void SetRefreshToken(string refreshToken)
    {
        lock (_gate)
        {
            _refreshToken = refreshToken;
        }
    }

    public void ClearRefreshToken()
    {
        lock (_gate)
        {
            _refreshToken = null;
        }
    }
}

public sealed class FallbackHostIdentity : IHostIdentity
{
    private readonly AgentOptions _options;

    public FallbackHostIdentity(AgentOptions options) => _options = options;

    public HostIdentityDto Read()
    {
        var identifier = Convert
            .ToHexString(System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes($"{Environment.MachineName}|fallback")))
            .ToLowerInvariant();

        return new HostIdentityDto(
            DeviceIdentifier: identifier,
            Hostname: Environment.MachineName,
            OsVersion: Environment.OSVersion.VersionString,
            AppVersion: _options.AgentVersion,
            AgentVersion: _options.AgentVersion);
    }

    public HostTelemetryDto Telemetry() =>
        new(System.Diagnostics.Process.GetCurrentProcess().WorkingSet64);
}
