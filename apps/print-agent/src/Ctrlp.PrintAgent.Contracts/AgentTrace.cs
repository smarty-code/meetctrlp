namespace Ctrlp.PrintAgent.Contracts;

public static class AgentTrace
{
    public static Action<string>? Sink { get; set; }

    public static void Write(string message) => Sink?.Invoke(message);
}
