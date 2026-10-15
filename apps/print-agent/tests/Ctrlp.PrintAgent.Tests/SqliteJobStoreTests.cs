using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core;
using Microsoft.Data.Sqlite;

namespace Ctrlp.PrintAgent.Tests;

public sealed class SqliteJobStoreTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"ctrlp-agent-tests-{Guid.NewGuid():N}");

    [Fact]
    public void PersistsJobsAndClaimsOnlyOneOwner()
    {
        var database = Path.Combine(_root, "queue.db");
        var first = Create(database);
        var created = first.Enqueue(Request("key-1"));

        var afterRestart = Create(database);
        var replay = afterRestart.Enqueue(Request("key-1"));
        var claimed = afterRestart.ClaimNext();

        Assert.Equal(created.Id, replay.Id);
        Assert.NotNull(claimed);
        Assert.Equal(created.Id, claimed!.Id);
        Assert.Equal("printing", claimed.State);
        Assert.Null(afterRestart.ClaimNext());
    }

    [Fact]
    public void CancelsQueuedWorkAndAllowsExplicitRetryAfterFailure()
    {
        var store = Create(Path.Combine(_root, "queue.db"));
        var queued = store.Enqueue(Request("key-2"));

        Assert.Equal("cancelled", store.Cancel(queued.Id)!.State);
        Assert.Null(store.ClaimNext());

        var second = store.Enqueue(Request("key-3"));
        Assert.NotNull(store.ClaimNext());
        Assert.Equal("failed", store.Fail(second.Id, "printer offline")!.State);
        var retried = store.Retry(second.Id);

        Assert.NotNull(retried);
        Assert.Equal("queued", retried!.State);
        Assert.Equal(1, retried.RetryCount);
        Assert.Equal(ReportStates.None, retried.ReportState);
    }

    [Fact]
    public void QueuesAFinalReportForEveryFinishedCloudJob()
    {
        var store = Create(Path.Combine(_root, "queue.db"));
        var queued = store.Enqueue(Request("key-ack"));
        Assert.Equal(ReportStates.None, queued.ReportState);
        Assert.NotNull(store.ClaimNext());

        var failed = store.Fail(queued.Id, "offline")!;
        Assert.Equal(ReportStates.Pending, failed.ReportState);
        Assert.Equal("AGENT_EXECUTION_FAILED", failed.ErrorCode);
        Assert.Equal(1, store.CountPendingReports("shop-1", "agent-1"));
        Assert.Single(store.DueReports("shop-1", "agent-1", long.MaxValue, 20));
        Assert.Empty(store.DueReports("shop-2", "agent-1", long.MaxValue, 20));

        store.DeferReport(queued.Id, nextAtMs: 5_000, "status 503");
        Assert.Empty(store.DueReports("shop-1", "agent-1", 4_999, 20));
        Assert.Equal(5_000, store.NextReportAt("shop-1", "agent-1"));
        Assert.Single(store.DueReports("shop-1", "agent-1", 5_000, 20));

        store.SetReportState(queued.Id, ReportStates.Acked);
        Assert.Equal(0, store.CountPendingReports("shop-1", "agent-1"));
        Assert.Null(store.NextReportAt("shop-1", "agent-1"));

        var retried = store.Retry(queued.Id);
        Assert.Equal(ReportStates.None, retried!.ReportState);
    }

    [Fact]
    public void CancelAndStagingFailureQueueReportsAndDeduplicateByLease()
    {
        var store = Create(Path.Combine(_root, "queue.db"));
        var queued = store.Enqueue(Request("key-cancel"));
        Assert.Equal(ReportStates.Pending, store.Cancel(queued.Id)!.ReportState);

        var staged = store.RecordStagingFailure(Request("key-stage") with { CloudJobId = "cloud-job-2", LeaseId = "lease-2" }, "hash mismatch");
        Assert.Equal("failed", staged.State);
        Assert.Equal("AGENT_STAGING_FAILED", staged.ErrorCode);
        Assert.Equal(ReportStates.Pending, staged.ReportState);
        Assert.Null(store.ClaimNext());
        // It has no file, so it can only be retried from the shop (new lease), not locally.
        Assert.Equal("failed", store.Retry(staged.Id)!.State);

        Assert.NotNull(store.FindCloudJob("cloud-job-2", "lease-2"));
        Assert.Null(store.FindCloudJob("cloud-job-2", "lease-3"));
    }

    [Fact]
    public void MigratesAcknowledgedRowsAndQueuesUnreportedOnes()
    {
        var database = Path.Combine(_root, "queue.db");
        var store = Create(database);
        var acked = store.Enqueue(Request("key-old-1"));
        var unacked = store.Enqueue(Request("key-old-2"));
        using (var connection = new SqliteConnection($"Data Source={database}"))
        {
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = $"""
                UPDATE jobs SET state = 'completed', report_state = 'none', cloud_acked = 1 WHERE id = '{acked.Id}';
                UPDATE jobs SET state = 'completed', report_state = 'none', cloud_acked = 0 WHERE id = '{unacked.Id}';
                """;
            command.ExecuteNonQuery();
        }

        var reopened = Create(database);
        Assert.Equal(ReportStates.Acked, reopened.Get(acked.Id)!.ReportState);
        Assert.Equal(ReportStates.Pending, reopened.Get(unacked.Id)!.ReportState);
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, recursive: true);
        }
    }

    private static SqliteJobStore Create(string database)
    {
        var store = new SqliteJobStore(database);
        store.Initialize();
        return store;
    }

    private static EnqueueJobRequest Request(string idempotencyKey) => new(
        PrinterId: "printer-1",
        DocumentPath: @"C:\staged\document.pdf",
        DocumentName: "document.pdf",
        Copies: 1,
        CloudJobId: "cloud-job-1",
        DocumentSha256: "abc",
        ResolvedSettings: "{}",
        IdempotencyKey: idempotencyKey,
        PagesTotal: 2,
        CloudOrderId: "order-1",
        CloudDocumentId: "doc-1",
        LeaseId: "lease-1",
        CloudShopId: "shop-1",
        CloudAgentId: "agent-1");
}
