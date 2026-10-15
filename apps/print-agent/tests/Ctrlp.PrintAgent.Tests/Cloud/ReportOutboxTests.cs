using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Ctrlp.PrintAgent.Core.Cloud;

namespace Ctrlp.PrintAgent.Tests.Cloud;

/// <summary>Implementation plan 10.6 #5: the report outbox.</summary>
public sealed class ReportOutboxTests
{
    private readonly FakeHttpHandler _api = new();
    private readonly InMemoryJobStore _jobs = new();
    private readonly AgentCloudContext _context = new();
    private readonly CloudStatus _status = new(new AgentNotifier());
    private readonly ReportOutbox _outbox;

    public ReportOutboxTests()
    {
        _context.Configure(new CloudConfig("http://api.test", "web-key", "https://doorbell.test"));
        _context.SetSession(new CloudSession("shop-1", "agent-1"));
        var client = new CloudApiClient(_context, new StaticTokens(), new HttpClient(_api));
        // No jitter, so backoff is exact.
        _outbox = new ReportOutbox(_jobs, _context, client, _status, random: new FixedRandom());
    }

    private sealed class FixedRandom : Random
    {
        public override double NextDouble() => 0.5;
    }

    private JobDto Finished(string cloudJobId, string state = "completed", string shopId = "shop-1")
    {
        var job = _jobs.Enqueue(new EnqueueJobRequest(
            "printer-1", @"C:\staged\document.pdf", "document.pdf", 1, cloudJobId, "abc", "{}", $"key-{cloudJobId}", 3,
            "order-1", "doc-1", $"lease-{cloudJobId}", shopId, "agent-1"));
        _jobs.ClaimNext();
        return state == "completed" ? _jobs.Complete(job.Id, 42)! : _jobs.Fail(job.Id, "paper jam")!;
    }

    private static HttpResponseMessage Results(params (string JobId, string Result)[] results) =>
        TestTokens.Json(HttpStatusCode.OK, new { results = results.Select(result => new { jobId = result.JobId, result = result.Result }) });

    [Fact]
    public async Task SendsFinalReportsAndMapsEachResult()
    {
        var ok = Finished("job-ok");
        var mismatch = Finished("job-old", state: "failed");
        var retry = Finished("job-retry");
        _api.Responder = (_, _) => Task.FromResult(Results(("job-ok", "ok"), ("job-old", "lease_mismatch"), ("job-retry", "retry")));

        var failure = await _outbox.SendAsync(_jobs.DueReports("shop-1", "agent-1", long.MaxValue, 20), CancellationToken.None);

        Assert.Null(failure);
        Assert.Equal(ReportStates.Acked, _jobs.Get(ok.Id)!.ReportState);
        Assert.Equal(ReportStates.Rejected, _jobs.Get(mismatch.Id)!.ReportState);
        Assert.Equal(ReportStates.Pending, _jobs.Get(retry.Id)!.ReportState);
        Assert.NotNull(_jobs.NextReportAt("shop-1", "agent-1"));

        var request = Assert.Single(_api.Requests);
        Assert.Equal("/api/v1/shops/shop-1/agents/agent-1/jobs/report", request.Uri.AbsolutePath);
        using var body = JsonDocument.Parse(request.Body!);
        var reports = body.RootElement.GetProperty("reports").EnumerateArray().ToList();
        Assert.Equal(3, reports.Count);
        var completed = reports.Single(report => report.GetProperty("jobId").GetString() == "job-ok");
        Assert.Equal("COMPLETED", completed.GetProperty("status").GetString());
        Assert.Equal("lease-job-ok", completed.GetProperty("leaseId").GetString());
        Assert.Equal(3, completed.GetProperty("pagesPrinted").GetInt32());
        Assert.Equal(42, completed.GetProperty("spoolerJobId").GetInt32());
        var failed = reports.Single(report => report.GetProperty("jobId").GetString() == "job-old");
        Assert.Equal("FAILED", failed.GetProperty("status").GetString());
        Assert.Equal("AGENT_EXECUTION_FAILED", failed.GetProperty("errorCode").GetString());
        Assert.Equal("paper jam", failed.GetProperty("errorMessage").GetString());
    }

    [Fact]
    public async Task AWholeRequestFailureKeepsReportsPendingAndHonoursRetryAfter()
    {
        Finished("job-1");
        var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
        response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(30));
        _api.Responder = (_, _) => Task.FromResult(response);

        var failure = await _outbox.SendAsync(_jobs.DueReports("shop-1", "agent-1", long.MaxValue, 20), CancellationToken.None);

        Assert.NotNull(failure);
        Assert.Equal(TimeSpan.FromSeconds(30), failure!.RetryAfter);
        Assert.Equal(1, _jobs.CountPendingReports("shop-1", "agent-1"));
    }

    [Fact]
    public void BacksOffFromOneSecondToFiveMinutes()
    {
        Assert.Equal(TimeSpan.FromSeconds(1), _outbox.Backoff(1));
        Assert.Equal(TimeSpan.FromSeconds(8), _outbox.Backoff(4));
        Assert.Equal(TimeSpan.FromMinutes(5), _outbox.Backoff(30));
    }

    [Fact]
    public void HoldsReportsForAnotherShop()
    {
        Finished("job-a", shopId: "shop-1");
        Finished("job-b", shopId: "shop-2");

        Assert.Single(_jobs.DueReports("shop-1", "agent-1", long.MaxValue, 20));
        Assert.Single(_jobs.DueReports("shop-2", "agent-1", long.MaxValue, 20));
    }

    [Fact]
    public async Task RejectsAReportItCanNeverPlace()
    {
        var job = _jobs.Enqueue(new EnqueueJobRequest("printer-1", @"C:\x.pdf", "x.pdf", 1, "job-x", IdempotencyKey: "key-x",
            CloudShopId: "shop-1", CloudAgentId: "agent-1"));
        _jobs.ClaimNext();
        _jobs.Complete(job.Id);

        var failure = await _outbox.SendAsync(_jobs.DueReports("shop-1", "agent-1", long.MaxValue, 20), CancellationToken.None);

        Assert.Null(failure);
        Assert.Equal(ReportStates.Rejected, _jobs.Get(job.Id)!.ReportState);
        Assert.Empty(_api.Requests);
    }

    [Fact]
    public async Task RunsInTheBackgroundAndPublishesThePendingCount()
    {
        _api.Responder = (_, _) => Task.FromResult(Results(("job-1", "ok")));
        using var stop = new CancellationTokenSource();
        var loop = _outbox.RunAsync(stop.Token);

        Finished("job-1");
        _outbox.Signal();
        await _api.WaitForAsync(_ => true, 1);
        for (var i = 0; i < 50 && _jobs.CountPendingReports("shop-1", "agent-1") > 0; i++)
        {
            await Task.Delay(20);
        }

        Assert.Equal(0, _jobs.CountPendingReports("shop-1", "agent-1"));
        Assert.Equal(0, _status.Current.PendingReports);
        stop.Cancel();
        await loop.WaitAsync(TimeSpan.FromSeconds(5));
    }
}
