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
        var claimed = afterRestart.ClaimNext("shop-1", "agent-1");

        Assert.Equal(created.Id, replay.Id);
        Assert.NotNull(claimed);
        Assert.Equal(created.Id, claimed!.Id);
        Assert.Equal("printing", claimed.State);
        Assert.Null(afterRestart.ClaimNext("shop-1", "agent-1"));
    }

    [Fact]
    public void CancelsQueuedWorkAndAllowsExplicitRetryOfALocalJobAfterFailure()
    {
        var store = Create(Path.Combine(_root, "queue.db"));
        var queued = store.Enqueue(LocalRequest("key-2"));

        Assert.Equal("cancelled", store.Cancel(queued.Id)!.State);
        Assert.Null(store.ClaimNext(null, null));

        var second = store.Enqueue(LocalRequest("key-3"));
        Assert.NotNull(store.ClaimNext(null, null));
        Assert.Equal("failed", store.Fail(second.Id, "printer offline")!.State);
        var retried = store.Retry(second.Id);

        Assert.NotNull(retried);
        Assert.Equal("queued", retried!.State);
        Assert.Equal(1, retried.RetryCount);
        Assert.Equal(ReportStates.None, retried.ReportState);
    }

    [Fact]
    public void ClaimsOnlyTheSignedInShopAndAgentsCloudJobsPlusLocalOnes()
    {
        var store = Create(Path.Combine(_root, "queue.db"));
        var mine = store.Enqueue(Request("key-mine"));
        var otherShop = store.Enqueue(Request("key-other-shop") with { CloudJobId = "cloud-job-2", CloudShopId = "shop-2" });
        var otherAgent = store.Enqueue(Request("key-other-agent") with { CloudJobId = "cloud-job-3", CloudAgentId = "agent-2" });
        var local = store.Enqueue(LocalRequest("key-local"));

        // Signed out (cloud.clear): only the local job prints; every cloud job waits.
        Assert.Equal(local.Id, store.ClaimNext(null, null)!.Id);
        Assert.Null(store.ClaimNext(null, null));

        // Switched to shop-2: its job, never shop-1's.
        Assert.Equal(otherShop.Id, store.ClaimNext("shop-2", "agent-1")!.Id);
        Assert.Null(store.ClaimNext("shop-2", "agent-1"));

        Assert.Equal(mine.Id, store.ClaimNext("shop-1", "agent-1")!.Id);
        Assert.Null(store.ClaimNext("shop-1", "agent-1"));
        Assert.Equal("queued", store.Get(otherAgent.Id)!.State);
    }

    [Fact]
    public void MigratesAnOldQueueKeepingRowsAndFailingCloudJobsWithoutAShop()
    {
        var database = Path.Combine(_root, "queue.db");
        Directory.CreateDirectory(_root);
        // The table as the first agent created it: no cloud shop/agent, lease or report columns.
        using (var connection = new SqliteConnection($"Data Source={database}"))
        {
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE jobs (
                  id TEXT PRIMARY KEY, cloud_job_id TEXT NULL, idempotency_key TEXT NULL UNIQUE, printer_id TEXT NULL,
                  document_name TEXT NULL, document_path TEXT NULL, document_sha256 TEXT NULL, resolved_settings TEXT NULL,
                  copies INTEGER NOT NULL, pages_total INTEGER NOT NULL DEFAULT 0, pages_printed INTEGER NOT NULL DEFAULT 0,
                  state TEXT NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0, spooler_job_id INTEGER NULL, error TEXT NULL,
                  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, started_at INTEGER NULL, completed_at INTEGER NULL);
                INSERT INTO jobs (id, cloud_job_id, document_path, copies, state, created_at, updated_at)
                VALUES ('job_old_cloud', 'cloud-old', 'C:\staged\old.pdf', 1, 'queued', 1, 1),
                       ('job_old_local', NULL, 'C:\staged\local.pdf', 1, 'queued', 2, 2);
                """;
            command.ExecuteNonQuery();
        }

        var store = Create(database);

        Assert.Equal(2, store.List().Count);
        var cloud = store.Get("job_old_cloud")!;
        Assert.Equal("failed", cloud.State);
        Assert.Contains("Retry it from the shop", cloud.Error);
        Assert.Null(cloud.CloudShopId);
        Assert.Equal("job_old_local", store.ClaimNext("shop-1", "agent-1")!.Id);
        Assert.Null(store.ClaimNext("shop-1", "agent-1"));
    }

    [Fact]
    public void RetryIsBlockedForACloudJob()
    {
        var store = Create(Path.Combine(_root, "queue.db"));
        var queued = store.Enqueue(Request("key-cloud-retry"));
        store.ClaimNext("shop-1", "agent-1");
        store.Fail(queued.Id, "paper jam");

        // Its lease is spent: re-queueing would print under it again. The shop retries it with a new lease.
        var unchanged = store.Retry(queued.Id)!;

        Assert.Equal("failed", unchanged.State);
        Assert.Equal(0, unchanged.RetryCount);
        Assert.Equal("lease-1", unchanged.LeaseId);
        Assert.Equal(ReportStates.Pending, unchanged.ReportState);
        Assert.Null(store.ClaimNext("shop-1", "agent-1"));
    }

    [Fact]
    public void CancelsOnlyWorkThatHasntStarted()
    {
        var store = Create(Path.Combine(_root, "queue.db"));
        var printing = store.Enqueue(Request("key-printing"));
        store.ClaimNext("shop-1", "agent-1");
        Assert.Equal("printing", store.Cancel(printing.Id)!.State);

        // FAILED on the server already: a CANCELLED report would come back invalid_state.
        store.Fail(printing.Id, "paper jam");
        store.SetReportState(printing.Id, ReportStates.Acked);
        var failed = store.Cancel(printing.Id)!;
        Assert.Equal("failed", failed.State);
        Assert.Equal(ReportStates.Acked, failed.ReportState);

        var queued = store.Enqueue(Request("key-queued") with { CloudJobId = "cloud-job-2", LeaseId = "lease-2" });
        var cancelled = store.Cancel(queued.Id)!;
        Assert.Equal("cancelled", cancelled.State);
        Assert.Equal(ReportStates.Pending, cancelled.ReportState);
    }

    [Fact]
    public void QueuesAFinalReportForEveryFinishedCloudJob()
    {
        var store = Create(Path.Combine(_root, "queue.db"));
        var queued = store.Enqueue(Request("key-ack"));
        Assert.Equal(ReportStates.None, queued.ReportState);
        Assert.NotNull(store.ClaimNext("shop-1", "agent-1"));

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

        // A cloud job isn't retried locally, so its settled report stays settled.
        var retried = store.Retry(queued.Id);
        Assert.Equal("failed", retried!.State);
        Assert.Equal(ReportStates.Acked, retried.ReportState);
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
        Assert.Null(store.ClaimNext("shop-1", "agent-1"));
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

    /// <summary>A job from this PC only (a test page), with no cloud ids.</summary>
    private static EnqueueJobRequest LocalRequest(string idempotencyKey) => new(
        PrinterId: "printer-1",
        DocumentPath: @"C:\staged\test-page.pdf",
        DocumentName: "test-page.pdf",
        IdempotencyKey: idempotencyKey,
        PagesTotal: 1);
}
