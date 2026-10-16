using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Core.Cloud;

namespace Ctrlp.PrintAgent.Tests.Cloud;

/// <summary>A token source that always has a valid token.</summary>
internal sealed class StaticTokens : IIdTokenSource
{
    private readonly IdTokenSnapshot _token = new(
        TestTokens.Jwt("static"),
        DateTimeOffset.UtcNow.AddHours(1),
        new IdTokenClaims("shop-1", "user-1", "OWNER"));

    public IdTokenSnapshot? Current => _token;

    public Task<IdTokenSnapshot?> GetAsync(bool forceRefresh, CancellationToken cancellationToken) =>
        Task.FromResult<IdTokenSnapshot?>(_token);
}

internal sealed class CountingReports : IReportSignal
{
    public int Signals { get; private set; }

    public void Signal() => Signals++;
}

/// <summary>Implementation plan 10.6 #4: the sync service.</summary>
public sealed class AgentSyncServiceTests : IDisposable
{
    private static readonly byte[] Pdf = Encoding.UTF8.GetBytes("%PDF-1.4 test document");
    private static readonly string PdfHash = Convert.ToHexString(SHA256.HashData(Pdf)).ToLowerInvariant();

    private readonly string _staging = Path.Combine(Path.GetTempPath(), $"ctrlp-sync-tests-{Guid.NewGuid():N}");
    private readonly FakeHttpHandler _api = new();
    private readonly FakeHttpHandler _files = new();
    private readonly InMemoryJobStore _jobs = new();
    private readonly AgentCloudContext _context = new();
    private readonly CountingReports _reports = new();
    private readonly List<JobEventDto> _published = [];
    private readonly AgentSyncService _sync;

    public AgentSyncServiceTests()
    {
        _context.Configure(new CloudConfig("http://api.test", "web-key", "https://doorbell.test"));
        _context.SetSession(new CloudSession("shop-1", "agent-1"));
        var status = new CloudStatus(new AgentNotifier());
        var client = new CloudApiClient(_context, new StaticTokens(), new HttpClient(_api));
        _sync = new AgentSyncService(_jobs, _context, client, status, _reports, _staging, new HttpClient(_files), publish: _published.Add);
        _files.Responder = (_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(Pdf) });
    }

    public void Dispose()
    {
        if (Directory.Exists(_staging))
        {
            Directory.Delete(_staging, recursive: true);
        }
    }

    private static object Job(
        string jobId,
        string leaseId = "lease-1",
        string? hash = null,
        bool download = true,
        int? pagesTotal = 4,
        int? pageCount = 2) => new
    {
        orderId = "order-1",
        orderNumber = "ORD-1",
        jobId,
        documentId = $"doc-{jobId}",
        documentName = "notes.pdf",
        leaseId,
        resolvedSettings = new { copies = 2, colorMode = "BW" },
        printerId = "printer-1",
        printerSystemName = "HP LaserJet",
        printerName = "HP",
        pagesTotal,
        redelivered = false,
        download = download
            ? new { url = $"https://files.test/{jobId}", sha256Hash = hash ?? PdfHash, mimeType = "application/pdf", pageCount, expiresIn = 3600 }
            : null,
    };

    private static HttpResponseMessage SyncResponse(bool more, params object[] claimed) =>
        TestTokens.Json(HttpStatusCode.OK, new { accepted = Array.Empty<string>(), claimed, more });

    /// <summary>A server that checks held leases: <paramref name="revoked"/> are applied before <paramref name="claimed"/>.</summary>
    private static HttpResponseMessage SyncResponse(object[] revoked, params object[] claimed) =>
        TestTokens.Json(HttpStatusCode.OK, new { accepted = Array.Empty<string>(), claimed, revoked, more = false });

    private static object Revoked(string jobId, string leaseId, string reason) => new { orderId = "order-1", jobId, leaseId, reason };

    private static List<(string OrderId, string JobId, string LeaseId)> HeldIn(RecordedRequest request)
    {
        using var body = JsonDocument.Parse(request.Body!);
        return body.RootElement.GetProperty("held").EnumerateArray()
            .Select(entry => (entry.GetProperty("orderId").GetString()!, entry.GetProperty("jobId").GetString()!, entry.GetProperty("leaseId").GetString()!))
            .ToList();
    }

    private async Task<JobDto> StageOne(string jobId = "job-1", string leaseId = "lease-1")
    {
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job(jobId, leaseId)));
        await _sync.SyncAsync(CancellationToken.None);
        return _jobs.List().Single(job => job.CloudJobId == jobId && job.LeaseId == leaseId);
    }

    [Fact]
    public async Task StagesVerifiesAndQueuesClaimedJobs()
    {
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job("job-1")));

        var queued = await _sync.SyncAsync(CancellationToken.None);

        Assert.Equal(1, queued);
        var job = Assert.Single(_jobs.List());
        Assert.Equal("queued", job.State);
        Assert.Equal("job-1", job.CloudJobId);
        Assert.Equal("lease-1", job.LeaseId);
        Assert.Equal("shop-1", job.CloudShopId);
        Assert.Equal("agent-1", job.CloudAgentId);
        Assert.Equal("HP LaserJet", job.PrinterId);
        Assert.Equal(2, job.Copies);
        Assert.True(File.Exists(job.DocumentPath));
        var request = Assert.Single(_api.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("/api/v1/shops/shop-1/agents/agent-1/sync", request.Uri.AbsolutePath);
    }

    [Fact]
    public async Task SyncsAgainWhileTheServerSaysMore()
    {
        var round = 0;
        _api.Responder = (_, _) => Task.FromResult(++round switch
        {
            1 => SyncResponse(true, Job("job-1")),
            2 => SyncResponse(true, Job("job-2")),
            _ => SyncResponse(false),
        });

        Assert.Equal(2, await _sync.SyncAsync(CancellationToken.None));
        Assert.Equal(3, _api.Count(request => request.Uri.AbsolutePath.EndsWith("/sync", StringComparison.Ordinal)));
    }

    [Fact]
    public async Task SkipsAJobItAlreadyHasWithTheSameLease()
    {
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job("job-1")));
        await _sync.SyncAsync(CancellationToken.None);
        var printed = _jobs.ClaimNext("shop-1", "agent-1")!;
        _jobs.Complete(printed.Id);

        // Re-delivered after a lost response: same lease, so it must not print again.
        Assert.Equal(0, await _sync.SyncAsync(CancellationToken.None));
        Assert.Single(_jobs.List());
        Assert.Equal(1, _files.Count(_ => true));

        // Retried by the shop: a new lease, so it prints again.
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job("job-1", leaseId: "lease-2")));
        Assert.Equal(1, await _sync.SyncAsync(CancellationToken.None));
        Assert.Equal(2, _jobs.List().Count);
    }

    [Fact]
    public async Task SendsTheLeasesItHoldsAndNothingElse()
    {
        // Each claim below has exactly one candidate, so it takes the row meant.
        _jobs.Enqueue(HeldRequest("job-printing"));
        _jobs.ClaimNext("shop-1", "agent-1");
        var done = _jobs.Enqueue(HeldRequest("job-done"));
        _jobs.ClaimNext("shop-1", "agent-1");
        _jobs.Complete(done.Id);
        _jobs.Enqueue(HeldRequest("job-queued"));
        _jobs.Enqueue(HeldRequest("job-other-shop") with { CloudShopId = "shop-2" });
        _jobs.Enqueue(HeldRequest("job-long-lease") with { LeaseId = new string('x', 81) });
        _jobs.Enqueue(new EnqueueJobRequest("printer-1", @"C:\staged\test.pdf", "test.pdf", IdempotencyKey: "local"));
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false));

        await _sync.SyncAsync(CancellationToken.None);

        // Queued and printing for this shop and agent; not finished, other shops', local, or over the server's 80 characters.
        var held = HeldIn(Assert.Single(_api.Requests)).OrderBy(entry => entry.JobId, StringComparer.Ordinal).ToList();
        Assert.Equal([("order-1", "job-printing", "lease-job-printing"), ("order-1", "job-queued", "lease-job-queued")], held);
    }

    [Fact]
    public async Task SendsAnEmptyHeldListWhenItHoldsNothing()
    {
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false));

        await _sync.SyncAsync(CancellationToken.None);

        Assert.Empty(HeldIn(Assert.Single(_api.Requests)));
    }

    [Fact]
    public async Task ARevokedLeaseIsDroppedWithoutAReportAndItsFileDeleted()
    {
        var staged = await StageOne();
        Assert.True(File.Exists(staged.DocumentPath));
        _api.Responder = (_, _) => Task.FromResult(SyncResponse([Revoked("job-1", "lease-1", "CANCELLED")]));

        await _sync.SyncAsync(CancellationToken.None);

        Assert.Equal([("order-1", "job-1", "lease-1")], HeldIn(_api.Requests[^1]));
        var dropped = _jobs.Get(staged.Id)!;
        Assert.Equal("cancelled", dropped.State);
        Assert.Equal(ReportStates.Revoked, dropped.ReportState);
        Assert.Equal("The shop cancelled this job.", dropped.Error);
        Assert.Equal(0, _jobs.CountPendingReports("shop-1", "agent-1"));
        Assert.False(File.Exists(staged.DocumentPath));
        Assert.Null(_jobs.ClaimNext("shop-1", "agent-1"));
        var published = Assert.Single(_published);
        Assert.Equal(RpcNotifications.JobCancelled, published.Type);
        Assert.Equal(staged.Id, published.Job.Id);
        // It no longer counts as held.
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false));
        await _sync.SyncAsync(CancellationToken.None);
        Assert.Empty(HeldIn(_api.Requests[^1]));
    }

    [Fact]
    public async Task ARevokeForAnotherLeaseKeepsTheJob()
    {
        var staged = await StageOne();
        _api.Responder = (_, _) => Task.FromResult(SyncResponse([Revoked("job-1", "lease-old", "RESCUED")]));

        await _sync.SyncAsync(CancellationToken.None);

        var kept = _jobs.Get(staged.Id)!;
        Assert.Equal("queued", kept.State);
        Assert.Equal(ReportStates.None, kept.ReportState);
        Assert.True(File.Exists(staged.DocumentPath));
        Assert.Empty(_published);
    }

    [Fact]
    public async Task ARevokedJobReclaimedUnderANewLeaseIsQueuedFresh()
    {
        var old = await StageOne();
        // The operator rescued it back onto this PC: revoked under lease-1, claimed again under lease-2.
        _api.Responder = (_, _) => Task.FromResult(SyncResponse([Revoked("job-1", "lease-1", "RESCUED")], Job("job-1", leaseId: "lease-2")));

        Assert.Equal(1, await _sync.SyncAsync(CancellationToken.None));

        Assert.Equal("cancelled", _jobs.Get(old.Id)!.State);
        Assert.Equal(ReportStates.Revoked, _jobs.Get(old.Id)!.ReportState);
        Assert.False(File.Exists(old.DocumentPath));
        var fresh = _jobs.List().Single(job => job.LeaseId == "lease-2");
        Assert.Equal("queued", fresh.State);
        Assert.Equal(ReportStates.None, fresh.ReportState);
        Assert.True(File.Exists(fresh.DocumentPath));
        Assert.Equal(fresh.Id, _jobs.ClaimNext("shop-1", "agent-1")!.Id);
    }

    [Fact]
    public async Task ARevokedJobAlreadyPrintingFinishesButIsNeverReported()
    {
        var staged = await StageOne();
        _jobs.ClaimNext("shop-1", "agent-1");
        _api.Responder = (_, _) => Task.FromResult(SyncResponse([Revoked("job-1", "lease-1", "RESCUED")]));

        await _sync.SyncAsync(CancellationToken.None);

        // The spooler can't be stopped: it keeps printing.
        Assert.Equal("printing", _jobs.Get(staged.Id)!.State);
        var finished = _jobs.Complete(staged.Id)!;
        Assert.Equal(ReportStates.Revoked, finished.ReportState);
        Assert.Equal(0, _jobs.CountPendingReports("shop-1", "agent-1"));
        Assert.Empty(_published);
    }

    private static EnqueueJobRequest HeldRequest(string cloudJobId) => new(
        "printer-1", @"C:\staged\document.pdf", "document.pdf", 1, cloudJobId, "abc", "{}", $"cloud-{cloudJobId}", 1,
        "order-1", "doc-1", $"lease-{cloudJobId}", "shop-1", "agent-1");

    [Fact]
    public async Task StagesEachLeaseInItsOwnFolder()
    {
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job("job-1")));
        await _sync.SyncAsync(CancellationToken.None);
        var first = Assert.Single(_jobs.List());
        Assert.Equal(Path.Combine(_staging, "job-1", "lease-1", "document.pdf"), first.DocumentPath);

        // The shop rescued it (new lease) while this PC still has the first attempt.
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job("job-1", leaseId: "lease-2")));
        await _sync.SyncAsync(CancellationToken.None);
        var second = _jobs.List().Single(job => job.LeaseId == "lease-2");
        Assert.Equal(Path.Combine(_staging, "job-1", "lease-2", "document.pdf"), second.DocumentPath);

        // The old attempt finishing deletes only its own file, never the rescued lease's.
        StagedDocument.TryDelete(_jobs.Fail(first.Id, "paper jam")!);
        Assert.False(File.Exists(first.DocumentPath));
        Assert.False(Directory.Exists(Path.Combine(_staging, "job-1", "lease-1")));
        Assert.True(File.Exists(second.DocumentPath));

        StagedDocument.TryDelete(_jobs.Complete(second.Id)!);
        Assert.False(Directory.Exists(Path.Combine(_staging, "job-1")));
    }

    [Fact]
    public async Task ANullPagesTotalDefaultsToOneInsteadOfFailingTheSync()
    {
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job("job-1", pagesTotal: null, pageCount: null), Job("job-2")));

        Assert.Equal(2, await _sync.SyncAsync(CancellationToken.None));

        Assert.Equal(1, _jobs.List().Single(job => job.CloudJobId == "job-1").PagesTotal);
        Assert.Equal(4, _jobs.List().Single(job => job.CloudJobId == "job-2").PagesTotal);
    }

    [Fact]
    public async Task RefusesALeaseIdThatWouldLeaveTheStagingFolder()
    {
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job("job-1", leaseId: "../../outside")));

        Assert.Equal(0, await _sync.SyncAsync(CancellationToken.None));

        var job = Assert.Single(_jobs.List());
        Assert.Equal("AGENT_STAGING_FAILED", job.ErrorCode);
        Assert.Empty(_files.Requests);
    }

    [Fact]
    public async Task AStagingFailureIsQueuedAsAFailedReport()
    {
        _api.Responder = (_, _) => Task.FromResult(SyncResponse(false, Job("bad-hash", hash: new string('0', 64)), Job("gone", download: false)));

        Assert.Equal(0, await _sync.SyncAsync(CancellationToken.None));

        var jobs = _jobs.List();
        Assert.Equal(2, jobs.Count);
        Assert.All(jobs, job =>
        {
            Assert.Equal("failed", job.State);
            Assert.Equal("AGENT_STAGING_FAILED", job.ErrorCode);
            Assert.Equal(ReportStates.Pending, job.ReportState);
            Assert.Null(job.DocumentPath);
        });
        Assert.Equal(2, _reports.Signals);
        Assert.Null(_jobs.ClaimNext("shop-1", "agent-1"));
    }

    [Fact]
    public async Task CoalescesSignalsIntoOneSync()
    {
        var calls = 0;
        var release = new TaskCompletionSource();
        _api.Responder = async (_, _) =>
        {
            Interlocked.Increment(ref calls);
            await release.Task;
            return SyncResponse(false);
        };
        using var stop = new CancellationTokenSource();
        var loop = _sync.RunAsync(stop.Token);

        _sync.Signal("ring");
        await _api.WaitForAsync(_ => true, 1);
        for (var i = 0; i < 10; i++)
        {
            _sync.Signal("ring");
        }
        release.SetResult();
        await _api.WaitForAsync(_ => true, 2);
        await Task.Delay(200);

        // One sync was running; the ten signals during it collapse into exactly one more.
        Assert.Equal(2, Volatile.Read(ref calls));
        stop.Cancel();
        await loop.WaitAsync(TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task DoesNothingWithoutASession()
    {
        _context.ClearSession();
        Assert.Equal(0, await _sync.SyncAsync(CancellationToken.None));
        Assert.Empty(_api.Requests);
    }

    [Fact]
    public void RetriesFailedSyncsWithBackoff()
    {
        Assert.Equal(TimeSpan.FromSeconds(2), AgentSyncService.Retry(1));
        Assert.Equal(TimeSpan.FromSeconds(4), AgentSyncService.Retry(2));
        Assert.Equal(TimeSpan.FromSeconds(60), AgentSyncService.Retry(10));
    }
}
