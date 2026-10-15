using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>The cloud services the pipe handlers talk to. Built before the dispatcher (implementation plan 10.1).</summary>
public sealed class AgentCloud
{
    public AgentCloud(
        AgentCloudContext context,
        FirebaseTokenManager tokens,
        ISyncTrigger sync,
        CloudStatus status)
    {
        Context = context;
        Tokens = tokens;
        Sync = sync;
        Status = status;
    }

    public AgentCloudContext Context { get; }
    public FirebaseTokenManager Tokens { get; }
    public ISyncTrigger Sync { get; }
    public CloudStatus Status { get; }

    /// <summary>Inert services for hosts and tests that don't exercise the cloud.</summary>
    public static AgentCloud CreateDetached(ISecretStore secrets)
    {
        var context = new AgentCloudContext();
        var status = new CloudStatus(new AgentNotifier());
        var tokens = new FirebaseTokenManager(context, secrets, status, new HttpClient());
        return new AgentCloud(context, tokens, NoSync.Instance, status);
    }

    private sealed class NoSync : ISyncTrigger
    {
        public static readonly NoSync Instance = new();

        public void Signal(string reason)
        {
        }
    }
}
