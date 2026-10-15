using System.Net.NetworkInformation;

namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>
/// Wakes the doorbell when Windows reports a network change, and when the PC resumes from sleep.
/// Resume shows up as the wall clock jumping ahead of the monotonic clock between two ticks.
/// </summary>
public sealed class ConnectivityMonitor
{
    public static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(5);

    private readonly DoorbellClient _doorbell;
    private readonly TimeProvider _time;
    private readonly Action<string>? _log;

    public ConnectivityMonitor(DoorbellClient doorbell, TimeProvider? time = null, Action<string>? log = null)
    {
        _doorbell = doorbell;
        _time = time ?? TimeProvider.System;
        _log = log;
    }

    public async Task RunAsync(CancellationToken stop)
    {
        NetworkChange.NetworkAvailabilityChanged += OnAvailabilityChanged;
        NetworkChange.NetworkAddressChanged += OnAddressChanged;
        try
        {
            var wall = _time.GetUtcNow();
            var mono = _time.GetTimestamp();
            while (!stop.IsCancellationRequested)
            {
                await Task.Delay(TickInterval, _time, stop).ConfigureAwait(false);
                var nowWall = _time.GetUtcNow();
                var nowMono = _time.GetTimestamp();
                var wallElapsed = nowWall - wall;
                var monoElapsed = _time.GetElapsedTime(mono, nowMono);
                if (IsResume(wallElapsed, monoElapsed, TickInterval))
                {
                    _log?.Invoke($"resume detected wallGapMs={(long)wallElapsed.TotalMilliseconds} monoGapMs={(long)monoElapsed.TotalMilliseconds}");
                    _doorbell.Wake("resume", closeStream: true);
                }

                wall = nowWall;
                mono = nowMono;
            }
        }
        catch (OperationCanceledException) when (stop.IsCancellationRequested)
        {
        }
        finally
        {
            NetworkChange.NetworkAvailabilityChanged -= OnAvailabilityChanged;
            NetworkChange.NetworkAddressChanged -= OnAddressChanged;
        }
    }

    /// <summary>
    /// The wall clock ran more than 10 s ahead of the monotonic clock (the PC slept), or a tick came more than
    /// 30 s late (the process was frozen, or the monotonic clock counts sleep on this PC). Either way the
    /// stream's socket is suspect.
    /// </summary>
    internal static bool IsResume(TimeSpan wallElapsed, TimeSpan monoElapsed, TimeSpan interval) =>
        wallElapsed - monoElapsed > TimeSpan.FromSeconds(10) ||
        monoElapsed > interval + TimeSpan.FromSeconds(30);

    private void OnAvailabilityChanged(object? sender, NetworkAvailabilityEventArgs e)
    {
        if (e.IsAvailable)
        {
            _doorbell.Wake("network available", closeStream: false);
        }
    }

    private void OnAddressChanged(object? sender, EventArgs e) =>
        _doorbell.Wake("network address changed", closeStream: false);
}
