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
        PagesTotal: 2);
}
