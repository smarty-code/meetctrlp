namespace Ctrlp.PrintAgent.Host;

internal sealed class AgentLog : IDisposable
{
    private readonly object _gate = new();
    private readonly StreamWriter _writer;

    private AgentLog(StreamWriter writer, string filePath)
    {
        _writer = writer;
        FilePath = filePath;
    }

    public string FilePath { get; }

    public static AgentLog Open()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Ctrlp",
            "PrintAgent");
        Directory.CreateDirectory(dir);
        var filePath = Path.Combine(dir, "agent.log");
        var stream = new FileStream(
            filePath,
            FileMode.Append,
            FileAccess.Write,
            FileShare.ReadWrite);
        var writer = new StreamWriter(stream) { AutoFlush = true };
        return new AgentLog(writer, filePath);
    }

    public void Write(string message)
    {
        var line = $"{DateTimeOffset.Now:O} {message}";
        lock (_gate)
        {
            _writer.WriteLine(line);
        }

        try
        {
            Console.Error.WriteLine(line);
        }
        catch (IOException)
        {
        }
    }

    public void Dispose() => _writer.Dispose();
}
