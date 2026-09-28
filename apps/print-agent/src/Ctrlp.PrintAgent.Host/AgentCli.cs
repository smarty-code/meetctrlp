using Ctrlp.PrintAgent.Core;

namespace Ctrlp.PrintAgent.Host;

internal static class AgentCli
{
    public static AgentOptions Parse(string[] args)
    {
        string? pipe = null;
        string? token = null;
        int? parentPid = null;
        var dev = false;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--pipe" when i + 1 < args.Length:
                    pipe = args[++i];
                    break;
                case "--token" when i + 1 < args.Length:
                    token = args[++i];
                    break;
                case "--parent-pid" when i + 1 < args.Length && int.TryParse(args[++i], out var pid):
                    parentPid = pid;
                    break;
                case "--dev":
                    dev = true;
                    break;
            }
        }

        pipe ??= "ctrlp-print-agent";
        if (string.IsNullOrWhiteSpace(token))
        {
            token = dev ? "dev-token" : Guid.NewGuid().ToString("N");
        }

        return new AgentOptions
        {
            PipeName = pipe,
            Token = token,
            ParentPid = parentPid,
            DevMode = dev,
        };
    }
}
