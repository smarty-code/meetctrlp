using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>
/// One-way notifications to the UI (board.changed, orders.attention, cloud.state). Sends are queued
/// in order and never block the caller; nothing is sent until the pipe server is attached.
/// </summary>
public sealed class AgentNotifier
{
    private readonly object _gate = new();
    private readonly Action<string>? _log;
    private Func<string, object, Task>? _sink;
    private Task _tail = Task.CompletedTask;

    public AgentNotifier(Action<string>? log = null) => _log = log;

    public void Attach(Func<string, object, Task> sink)
    {
        lock (_gate)
        {
            _sink = sink;
        }
    }

    public void Publish(string method, object payload)
    {
        lock (_gate)
        {
            var sink = _sink;
            if (sink is null)
            {
                return;
            }

            _tail = _tail.ContinueWith(_ => SendAsync(sink, method, payload), TaskScheduler.Default).Unwrap();
        }
    }

    /// <summary>Completes when everything published so far has been handed to the pipe.</summary>
    internal Task DrainAsync()
    {
        lock (_gate)
        {
            return _tail;
        }
    }

    private async Task SendAsync(Func<string, object, Task> sink, string method, object payload)
    {
        try
        {
            await sink(method, payload).ConfigureAwait(false);
        }
        catch (Exception exception)
        {
            _log?.Invoke($"notification {method} dropped: {exception.GetType().Name}: {exception.Message}");
        }
    }
}

/// <summary>The agent's view of the cloud connection, published as <c>cloud.state</c> whenever it changes.</summary>
public sealed class CloudStatus
{
    private readonly object _gate = new();
    private readonly AgentNotifier _notifier;
    private CloudStateNotification _current = new(DoorbellStates.Offline, TokenStates.None, 0);

    public CloudStatus(AgentNotifier notifier) => _notifier = notifier;

    public CloudStateNotification Current
    {
        get
        {
            lock (_gate)
            {
                return _current;
            }
        }
    }

    public void SetDoorbell(string doorbell) => Update(state => state with { Doorbell = doorbell });

    public void SetToken(string token) => Update(state => state with { Token = token });

    public void SetLastError(string? error) => Update(state => state with { LastError = error });

    public void Update(Func<CloudStateNotification, CloudStateNotification> change)
    {
        lock (_gate)
        {
            var next = change(_current);
            if (next == _current)
            {
                return;
            }

            _current = next;
            // Queued under the lock so the UI sees changes in the order they happened.
            _notifier.Publish(RpcNotifications.CloudState, next);
        }
    }

    /// <summary>Sends the current state again, for a UI that attached after the last change.</summary>
    public void Republish()
    {
        lock (_gate)
        {
            _notifier.Publish(RpcNotifications.CloudState, _current);
        }
    }
}

/// <summary>Something that runs a cloud sync when asked. Signals coalesce.</summary>
public interface ISyncTrigger
{
    void Signal(string reason);
}

/// <summary>
/// Auto-reset signal for one consumer loop. A <see cref="Set"/> while nobody waits is remembered,
/// and several sets before the next wait count as one.
/// </summary>
internal sealed class AsyncSignal
{
    private readonly object _gate = new();
    private TaskCompletionSource _pending = Create();

    public void Set()
    {
        lock (_gate)
        {
            _pending.TrySetResult();
        }
    }

    public void Reset()
    {
        lock (_gate)
        {
            if (_pending.Task.IsCompleted)
            {
                _pending = Create();
            }
        }
    }

    public async Task WaitAsync(CancellationToken cancellationToken)
    {
        Task signal;
        lock (_gate)
        {
            signal = _pending.Task;
        }

        await signal.WaitAsync(cancellationToken).ConfigureAwait(false);
        Reset();
    }

    /// <summary>Returns true when signalled, false when <paramref name="timeout"/> passed first.</summary>
    public async Task<bool> WaitAsync(TimeSpan timeout, TimeProvider time, CancellationToken cancellationToken)
    {
        Task signal;
        lock (_gate)
        {
            signal = _pending.Task;
        }

        if (!signal.IsCompleted)
        {
            using var delayCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var delay = Task.Delay(timeout, time, delayCts.Token);
            await Task.WhenAny(signal, delay).ConfigureAwait(false);
            delayCts.Cancel(); // release the timer
        }

        cancellationToken.ThrowIfCancellationRequested();
        if (!signal.IsCompleted)
        {
            return false;
        }

        Reset();
        return true;
    }

    private static TaskCompletionSource Create() => new(TaskCreationOptions.RunContinuationsAsynchronously);
}
