using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;
using Ctrlp.PrintAgent.Contracts;
using Microsoft.Win32;

namespace Ctrlp.PrintAgent.Windows;

public sealed class WindowsHostIdentity : IHostIdentity
{
    private readonly string _appVersion;
    private readonly string _agentVersion;

    public WindowsHostIdentity(string appVersion, string agentVersion)
    {
        _appVersion = appVersion;
        _agentVersion = agentVersion;
    }

    public HostIdentityDto Read()
    {
        var guid = ReadMachineGuid() ?? "unknown-machine";
        var mac = FirstActiveMac() ?? "none";
        var identifier = Convert
            .ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{guid}|{mac}")))
            .ToLowerInvariant();

        return new HostIdentityDto(
            DeviceIdentifier: identifier,
            Hostname: Environment.MachineName,
            OsVersion: DescribeOs(),
            AppVersion: _appVersion,
            AgentVersion: _agentVersion);
    }

    public HostTelemetryDto Telemetry() =>
        new(System.Diagnostics.Process.GetCurrentProcess().WorkingSet64);

    private static string DescribeOs()
    {
        var version = Environment.OSVersion.Version;
        var name = version.Build >= 22000 ? "Windows 11" : "Windows 10";
        return $"{name} ({version})";
    }

    private static string? ReadMachineGuid()
    {
        using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
        return key?.GetValue("MachineGuid")?.ToString();
    }

    private static string? FirstActiveMac()
    {
        return NetworkInterface
            .GetAllNetworkInterfaces()
            .Where(network =>
                network.OperationalStatus == OperationalStatus.Up
                && network.NetworkInterfaceType is not NetworkInterfaceType.Loopback
                && network.NetworkInterfaceType is not NetworkInterfaceType.Tunnel)
            .Select(network => network.GetPhysicalAddress().ToString())
            .FirstOrDefault(address => !string.IsNullOrWhiteSpace(address) && address != "000000000000");
    }
}
