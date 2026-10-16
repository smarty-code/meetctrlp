using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Core.Cloud;
using Ctrlp.PrintAgent.Ipc;

namespace Ctrlp.PrintAgent.Tests;

/// <summary>The local queue stays scoped to the signed-in shop, and retry, cancel and cleanup respect leases.</summary>
public sealed class LocalQueueTests : IDisposable
{
    private readonly string _staging = Path.Combine(Path.GetTempPath(), $"ctrlp-queue-tests-{Guid.NewGuid():N}");
    private readonly InMemoryJobStore _jobs = new();
    private readonly AgentCloudContext _context = new();
    private readonly JsonRpcSession _session;
    private int _id;

    public LocalQueueTests()
    {
        var runtime = new AgentRuntime(new AgentOptions { PipeName = "test", Token = "secret" }, new StaticPrinterCatalog(), _jobs);
        runtime.MarkReady();
        _session = new JsonRpcSession(runtime.CreateDispatcher(), new RpcContext { ExpectedToken = "secret", AllowAnonymous = false });
    }

    public void Dispose()
    {
        if (Directory.Exists(_staging))
        {
            Directory.Delete(_staging, recursive: true);
        }
    }

    [Fact]
    public void TheWorkerClaimsCloudJobsOnlyForTheCurrentSession()
    {
        var worker = new PrintQueueWorker(_jobs, new FailingExecutor(), cloud: _context);
        var shop1 = _jobs.Enqueue(Cloud("job-1", "shop-1"));
        var shop2 = _jobs.Enqueue(Cloud("job-2", "shop-2"));
        var local = _jobs.Enqueue(Local());

        // Before sign-in (or after cloud.clear) only this PC's own job prints.
        Assert.Equal(local.Id, worker.ClaimNext()!.Id);
        Assert.Null(worker.ClaimNext());

        _context.SetSession(new CloudSession("shop-2", "agent-1"));
        Assert.Equal(shop2.Id, worker.ClaimNext()!.Id);
        Assert.Null(worker.ClaimNext());

        _context.ClearSession();
        Assert.Null(worker.ClaimNext());
        _context.SetSession(new CloudSession("shop-1", "agent-1"));
        Assert.Equal(shop1.Id, worker.ClaimNext()!.Id);
    }

    [Fact]
    public async Task TheWorkerDeletesAFailedCloudJobsFileButKeepsALocalOneForRetry()
    {
        _context.SetSession(new CloudSession("shop-1", "agent-1"));
        var cloudPath = Stage("job-1", "lease-job-1");
        var localPath = Stage("local", "test-page");
        _jobs.Enqueue(Cloud("job-1", "shop-1") with { DocumentPath = cloudPath });
        _jobs.Enqueue(Local() with { DocumentPath = localPath });
        var worker = new PrintQueueWorker(_jobs, new FailingExecutor(), cloud: _context);

        using var stop = new CancellationTokenSource();
        var loop = worker.RunAsync(stop.Token);
        for (var i = 0; i < 250 && _jobs.List().Any(job => job.State != "failed"); i++)
        {
            await Task.Delay(20);
        }
        stop.Cancel();
        try
        {
            await loop.WaitAsync(TimeSpan.FromSeconds(5));
        }
        catch (OperationCanceledException)
        {
        }

        Assert.All(_jobs.List(), job => Assert.Equal("failed", job.State));
        Assert.False(File.Exists(cloudPath));
        Assert.False(Directory.Exists(Path.Combine(_staging, "job-1")));
        Assert.True(File.Exists(localPath));
    }

    [Fact]
    public void TheStartupSweepRemovesFilesOfFinishedCloudJobs()
    {
        var path = Stage("job-1", "lease-job-1");
        var job = _jobs.Enqueue(Cloud("job-1", "shop-1") with { DocumentPath = path });
        // Restart recovery fails a job that was printing when the agent died; nothing deleted its file.
        _jobs.ClaimNext("shop-1", "agent-1");
        _jobs.Fail(job.Id, "Agent restarted while print execution was in progress");

        StagedDocument.Sweep(_jobs);

        Assert.False(File.Exists(path));
    }

    [Fact]
    public async Task RetryRpcRefusesACloudJob()
    {
        var job = _jobs.Enqueue(Cloud("job-1", "shop-1"));
        _jobs.ClaimNext("shop-1", "agent-1");
        _jobs.Fail(job.Id, "paper jam");

        var response = await Request(RpcMethods.JobsRetry, $$"""{"id":"{{job.Id}}"}""");

        Assert.Equal(RpcErrorCodes.InvalidJobState, response.GetProperty("error").GetProperty("code").GetInt32());
        Assert.Equal("failed", _jobs.Get(job.Id)!.State);
        Assert.Equal(0, _jobs.Get(job.Id)!.RetryCount);
    }

    [Fact]
    public async Task RetryRpcRequeuesAFailedLocalJob()
    {
        var job = _jobs.Enqueue(Local());
        _jobs.ClaimNext(null, null);
        _jobs.Fail(job.Id, "printer offline");

        var response = await Request(RpcMethods.JobsRetry, $$"""{"id":"{{job.Id}}"}""");

        Assert.Equal("queued", response.GetProperty("result").GetProperty("state").GetString());
        Assert.Equal(1, _jobs.Get(job.Id)!.RetryCount);
    }

    [Fact]
    public async Task CancelRpcRefusesAJobThatIsPrintingOrFailed()
    {
        var job = _jobs.Enqueue(Cloud("job-1", "shop-1"));
        _jobs.ClaimNext("shop-1", "agent-1");

        var printing = await Request(RpcMethods.JobsCancel, $$"""{"id":"{{job.Id}}"}""");
        Assert.Equal(RpcErrorCodes.InvalidJobState, printing.GetProperty("error").GetProperty("code").GetInt32());
        Assert.Equal("printing", _jobs.Get(job.Id)!.State);

        _jobs.Fail(job.Id, "paper jam");
        _jobs.SetReportState(job.Id, ReportStates.Acked);
        var failed = await Request(RpcMethods.JobsCancel, $$"""{"id":"{{job.Id}}"}""");
        Assert.Equal(RpcErrorCodes.InvalidJobState, failed.GetProperty("error").GetProperty("code").GetInt32());
        Assert.Equal(ReportStates.Acked, _jobs.Get(job.Id)!.ReportState);
    }

    [Fact]
    public async Task CancelRpcCancelsAQueuedCloudJobAndDeletesItsFile()
    {
        var path = Stage("job-1", "lease-job-1");
        var job = _jobs.Enqueue(Cloud("job-1", "shop-1") with { DocumentPath = path });

        var response = await Request(RpcMethods.JobsCancel, $$"""{"id":"{{job.Id}}"}""");

        Assert.Equal("cancelled", response.GetProperty("result").GetProperty("state").GetString());
        Assert.Equal(ReportStates.Pending, _jobs.Get(job.Id)!.ReportState);
        Assert.False(File.Exists(path));
    }

    private static EnqueueJobRequest Cloud(string cloudJobId, string shopId) => new(
        "printer-1", @"C:\staged\document.pdf", "document.pdf", 1, cloudJobId, "abc", "{}", $"cloud-{cloudJobId}", 2,
        "order-1", "doc-1", $"lease-{cloudJobId}", shopId, "agent-1");

    private static EnqueueJobRequest Local() => new("printer-1", @"C:\staged\test-page.pdf", "test-page.pdf", PagesTotal: 1);

    private string Stage(string jobId, string leaseId)
    {
        var path = AgentSyncService.StagingPath(_staging, jobId, leaseId, "application/pdf");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, "%PDF-1.4");
        return path;
    }

    private async Task<JsonElement> Request(string method, string paramsJson)
    {
        if (_id == 0)
        {
            await Send(RpcMethods.Hello, """{"token":"secret"}""");
        }

        return await Send(method, paramsJson);
    }

    private async Task<JsonElement> Send(string method, string paramsJson)
    {
        var frame = Encoding.UTF8.GetBytes($$"""{"jsonrpc":"2.0","id":{{++_id}},"method":"{{method}}","params":{{paramsJson}}}""");
        var response = await _session.HandleFrameAsync(frame, CancellationToken.None);
        Assert.NotNull(response);
        using var document = JsonDocument.Parse(response);
        return document.RootElement.Clone();
    }

    private sealed class FailingExecutor : IPrintExecutor
    {
        public Task<PrintExecutionResult> ExecuteAsync(JobDto job, CancellationToken cancellationToken) =>
            Task.FromResult(new PrintExecutionResult(false, Error: "printer offline"));
    }
}
