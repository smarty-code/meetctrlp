namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>Values from <c>cloud.configure</c>. The Web API key is used only for the Secure Token API.</summary>
public sealed record CloudConfig(string ServerBaseUrl, string FirebaseApiKey, string DatabaseUrl);

/// <summary>Values from <c>cloud.session</c>: which shop this PC signed in to, and its registered device id.</summary>
public sealed record CloudSession(string ShopId, string AgentId);

/// <summary>
/// What the UI told the agent about the cloud. Held in memory only; the UI sends it again
/// on every start (<c>agent:ready</c>), so nothing here needs to survive a restart.
/// </summary>
public sealed class AgentCloudContext
{
    private readonly object _gate = new();
    private CloudConfig? _config;
    private CloudSession? _session;

    /// <summary>Raised after a value actually changed. Handlers must not block.</summary>
    public event Action? Changed;

    /// <summary>Raised on every <c>cloud.session</c>, changed or not: a new login can follow an invalid token.</summary>
    public event Action? SessionRenewed;

    public CloudConfig? Config
    {
        get
        {
            lock (_gate)
            {
                return _config;
            }
        }
    }

    public CloudSession? Session
    {
        get
        {
            lock (_gate)
            {
                return _session;
            }
        }
    }

    public void Configure(CloudConfig config)
    {
        lock (_gate)
        {
            if (config == _config)
            {
                return;
            }

            _config = config;
        }

        Changed?.Invoke();
    }

    public void SetSession(CloudSession session)
    {
        bool changed;
        lock (_gate)
        {
            changed = session != _session;
            _session = session;
        }

        if (changed)
        {
            Changed?.Invoke();
        }

        SessionRenewed?.Invoke();
    }

    public void ClearSession()
    {
        lock (_gate)
        {
            if (_session is null)
            {
                return;
            }

            _session = null;
        }

        Changed?.Invoke();
    }
}
