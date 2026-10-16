using Ctrlp.PrintAgent.Contracts;
using Microsoft.Data.Sqlite;

namespace Ctrlp.PrintAgent.Core;

/// <summary>
/// Durable, per-user execution journal. It deliberately stores only staging metadata:
/// the document's display name and hash are useful for recovery, while the physical
/// file remains in the job staging directory and is never logged.
/// </summary>
public sealed class SqliteJobStore : IJobRepository
{
    private const int MaxQueuedJobs = 500;
    private readonly string _connectionString;

    public SqliteJobStore(string databasePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(databasePath);
        Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared,
        }.ToString();
    }

    public void Initialize()
    {
        using var connection = Open();
        Execute(connection, """
            CREATE TABLE IF NOT EXISTS jobs (
              id TEXT PRIMARY KEY,
              cloud_job_id TEXT NULL,
              cloud_order_id TEXT NULL,
              cloud_document_id TEXT NULL,
              lease_id TEXT NULL,
              idempotency_key TEXT NULL UNIQUE,
              printer_id TEXT NULL,
              document_name TEXT NULL,
              document_path TEXT NULL,
              document_sha256 TEXT NULL,
              resolved_settings TEXT NULL,
              copies INTEGER NOT NULL,
              pages_total INTEGER NOT NULL DEFAULT 0,
              pages_printed INTEGER NOT NULL DEFAULT 0,
              state TEXT NOT NULL,
              retry_count INTEGER NOT NULL DEFAULT 0,
              spooler_job_id INTEGER NULL,
              error TEXT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              started_at INTEGER NULL,
              completed_at INTEGER NULL
            );
            CREATE INDEX IF NOT EXISTS idx_jobs_work ON jobs (state, created_at);
            CREATE INDEX IF NOT EXISTS idx_jobs_cloud ON jobs (cloud_job_id);
            """);
        EnsureColumn(connection, "cloud_order_id", "TEXT NULL");
        EnsureColumn(connection, "cloud_document_id", "TEXT NULL");
        EnsureColumn(connection, "lease_id", "TEXT NULL");
        EnsureColumn(connection, "cloud_acked", "INTEGER NOT NULL DEFAULT 0");
        EnsureColumn(connection, "cloud_shop_id", "TEXT NULL");
        EnsureColumn(connection, "cloud_agent_id", "TEXT NULL");
        EnsureColumn(connection, "error_code", "TEXT NULL");
        EnsureColumn(connection, "report_state", "TEXT NOT NULL DEFAULT 'none'");
        EnsureColumn(connection, "report_attempts", "INTEGER NOT NULL DEFAULT 0");
        EnsureColumn(connection, "report_next_at", "INTEGER NULL");
        EnsureColumn(connection, "report_last_error", "TEXT NULL");
        Execute(connection, "CREATE INDEX IF NOT EXISTS idx_jobs_report ON jobs (report_state, cloud_shop_id, cloud_agent_id, report_next_at);");
        // cloud_acked is replaced by report_state (implementation plan 10.5).
        Execute(connection, "UPDATE jobs SET report_state = 'acked' WHERE cloud_acked = 1 AND report_state = 'none';");
        // A prior agent process cannot still be printing after a crash. Surface those
        // records for deliberate operator retry instead of silently duplicating output,
        // and report the failure to the cloud.
        Execute(connection, """
            UPDATE jobs
            SET state = 'failed',
                error = COALESCE(error, 'Agent restarted while print execution was in progress'),
                error_code = COALESCE(error_code, 'AGENT_EXECUTION_FAILED'),
                updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000,
                completed_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000,
                report_state = CASE WHEN cloud_job_id IS NOT NULL AND report_state = 'none' THEN 'pending' ELSE report_state END
            WHERE state = 'printing';
            """);
        // ClaimNext prints a cloud job only for the shop and PC that claimed it (cloud_shop_id, cloud_agent_id).
        // A cloud job queued before those columns were filled in can't be matched to any session, so it would
        // sit queued forever. Fail it, keeping the row, so the shop retries it under a new lease.
        Execute(connection, """
            UPDATE jobs
            SET state = 'failed',
                error = 'Queued before this PC recorded its shop. Retry it from the shop.',
                error_code = 'AGENT_EXECUTION_FAILED',
                updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000,
                completed_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
            WHERE state IN ('created', 'queued') AND cloud_job_id IS NOT NULL
              AND (cloud_shop_id IS NULL OR cloud_agent_id IS NULL);
            """);
        // Finished cloud jobs from the old poll loop that were never acknowledged still need a report.
        Execute(connection, """
            UPDATE jobs SET report_state = 'pending'
            WHERE cloud_job_id IS NOT NULL AND report_state = 'none' AND state IN ('completed', 'failed', 'cancelled');
            """);
    }

    public JobDto Enqueue(EnqueueJobRequest request)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = QuerySingle(
                connection,
                transaction,
                "SELECT * FROM jobs WHERE idempotency_key = $idempotencyKey",
                ("$idempotencyKey", request.IdempotencyKey));
            if (existing is not null)
            {
                transaction.Commit();
                return existing;
            }
        }

        var queued = ScalarLong(connection, transaction, "SELECT COUNT(*) FROM jobs WHERE state = 'queued'");
        if (queued >= MaxQueuedJobs)
        {
            throw new InvalidOperationException("The local print queue is full.");
        }

        var now = Now();
        var id = $"job_{Guid.NewGuid():N}";
        Execute(
            connection,
            transaction,
            """
            INSERT INTO jobs (
              id, cloud_job_id, cloud_order_id, cloud_document_id, lease_id, idempotency_key, printer_id, document_name, document_path,
              document_sha256, resolved_settings, copies, pages_total, state, created_at, updated_at, cloud_shop_id, cloud_agent_id
            ) VALUES (
              $id, $cloudJobId, $cloudOrderId, $cloudDocumentId, $leaseId, $idempotencyKey, $printerId, $documentName, $documentPath,
              $documentSha256, $resolvedSettings, $copies, $pagesTotal, 'queued', $now, $now, $cloudShopId, $cloudAgentId
            )
            """,
            ("$id", id),
            ("$cloudJobId", request.CloudJobId),
            ("$cloudOrderId", request.CloudOrderId),
            ("$cloudDocumentId", request.CloudDocumentId),
            ("$leaseId", request.LeaseId),
            ("$idempotencyKey", request.IdempotencyKey),
            ("$printerId", request.PrinterId),
            ("$documentName", request.DocumentName),
            ("$documentPath", request.DocumentPath),
            ("$documentSha256", request.DocumentSha256),
            ("$resolvedSettings", request.ResolvedSettings),
            ("$copies", Math.Max(1, request.Copies)),
            ("$pagesTotal", Math.Max(0, request.PagesTotal)),
            ("$now", now),
            ("$cloudShopId", request.CloudShopId),
            ("$cloudAgentId", request.CloudAgentId));
        transaction.Commit();
        return Get(id)!;
    }

    public JobDto RecordStagingFailure(EnqueueJobRequest request, string reason)
    {
        // No document_path: the worker never claims it. It exists only so the outbox reports FAILED.
        var job = Enqueue(request with { DocumentPath = null });
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE jobs
            SET state = 'failed', error = $error, error_code = 'AGENT_STAGING_FAILED', completed_at = $now, updated_at = $now,
                report_state = CASE WHEN cloud_job_id IS NOT NULL THEN 'pending' ELSE report_state END,
                report_attempts = 0, report_next_at = NULL
            WHERE id = $id
            """;
        command.Parameters.AddWithValue("$id", job.Id);
        command.Parameters.AddWithValue("$error", reason);
        command.Parameters.AddWithValue("$now", Now());
        command.ExecuteNonQuery();
        return Get(job.Id)!;
    }

    public JobDto? FindCloudJob(string cloudJobId, string leaseId)
    {
        using var connection = Open();
        return QuerySingle(
            connection,
            null,
            "SELECT * FROM jobs WHERE cloud_job_id = $cloudJobId AND lease_id = $leaseId ORDER BY created_at DESC LIMIT 1",
            ("$cloudJobId", cloudJobId),
            ("$leaseId", leaseId));
    }

    public IReadOnlyList<JobDto> DueReports(string shopId, string agentId, long nowMs, int limit)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT * FROM jobs
            WHERE report_state = 'pending' AND cloud_shop_id = $shopId AND cloud_agent_id = $agentId
              AND (report_next_at IS NULL OR report_next_at <= $now)
            ORDER BY completed_at, created_at
            LIMIT $limit
            """;
        command.Parameters.AddWithValue("$shopId", shopId);
        command.Parameters.AddWithValue("$agentId", agentId);
        command.Parameters.AddWithValue("$now", nowMs);
        command.Parameters.AddWithValue("$limit", limit);
        using var reader = command.ExecuteReader();
        var jobs = new List<JobDto>();
        while (reader.Read())
        {
            jobs.Add(Read(reader));
        }

        return jobs;
    }

    public int CountPendingReports(string shopId, string agentId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM jobs WHERE report_state = 'pending' AND cloud_shop_id = $shopId AND cloud_agent_id = $agentId";
        command.Parameters.AddWithValue("$shopId", shopId);
        command.Parameters.AddWithValue("$agentId", agentId);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    public long? NextReportAt(string shopId, string agentId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT MIN(COALESCE(report_next_at, 0)) FROM jobs
            WHERE report_state = 'pending' AND cloud_shop_id = $shopId AND cloud_agent_id = $agentId
            """;
        command.Parameters.AddWithValue("$shopId", shopId);
        command.Parameters.AddWithValue("$agentId", agentId);
        var value = command.ExecuteScalar();
        return value is null or DBNull ? null : Convert.ToInt64(value);
    }

    public void SetReportState(string id, string state)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "UPDATE jobs SET report_state = $state, report_next_at = NULL, report_last_error = NULL WHERE id = $id";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$state", state);
        command.ExecuteNonQuery();
    }

    public void DeferReport(string id, long nextAtMs, string error)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE jobs SET report_attempts = report_attempts + 1, report_next_at = $nextAt, report_last_error = $error
            WHERE id = $id AND report_state = 'pending'
            """;
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$nextAt", nextAtMs);
        command.Parameters.AddWithValue("$error", error.Length > 500 ? error[..500] : error);
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<JobDto> List()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT * FROM jobs ORDER BY created_at DESC";
        using var reader = command.ExecuteReader();
        var jobs = new List<JobDto>();
        while (reader.Read())
        {
            jobs.Add(Read(reader));
        }

        return jobs;
    }

    public JobDto? Get(string id)
    {
        using var connection = Open();
        return QuerySingle(connection, null, "SELECT * FROM jobs WHERE id = $id", ("$id", id));
    }

    // Only work that hasn't started: a failed cloud job is already FAILED on the server, which answers a
    // CANCELLED report for it with invalid_state.
    public JobDto? Cancel(string id) =>
        Update(id, $"state = 'cancelled', completed_at = $now, {PendingReport}", "state IN ('created', 'queued')");

    public JobDto? ClaimNext(string? shopId, string? agentId)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        // A null shop or agent matches no cloud row (NULL = NULL is not true), so signed out only local jobs print.
        var job = QuerySingle(
            connection,
            transaction,
            """
            SELECT * FROM jobs
            WHERE state = 'queued' AND document_path IS NOT NULL
              AND (cloud_job_id IS NULL OR (cloud_shop_id = $shopId AND cloud_agent_id = $agentId))
            ORDER BY created_at LIMIT 1
            """,
            ("$shopId", shopId),
            ("$agentId", agentId));
        if (job is null)
        {
            transaction.Commit();
            return null;
        }

        var now = Now();
        Execute(
            connection,
            transaction,
            """
            UPDATE jobs
            SET state = 'printing', started_at = $now, updated_at = $now
            WHERE id = $id AND state = 'queued'
            """,
            ("$id", job.Id),
            ("$now", now));
        var claimed = QuerySingle(connection, transaction, "SELECT * FROM jobs WHERE id = $id", ("$id", job.Id));
        transaction.Commit();
        return claimed;
    }

    public JobDto? Complete(string id, int? spoolerJobId = null) =>
        Update(id, $"state = 'completed', spooler_job_id = $spoolerJobId, completed_at = $now, error = NULL, error_code = NULL, {PendingReport}", "state = 'printing'", ("$spoolerJobId", spoolerJobId));

    public JobDto? Fail(string id, string reason) =>
        Update(id, $"state = 'failed', error = $error, error_code = 'AGENT_EXECUTION_FAILED', completed_at = $now, {PendingReport}", "state = 'printing'", ("$error", reason));

    // A cloud job's lease is spent once it failed: re-printing under it would be reported lease_mismatch or
    // invalid_state, and would print twice if the shop also rescued it. The shop retries it with a new lease.
    public JobDto? Retry(string id) =>
        Update(id, "state = 'queued', retry_count = retry_count + 1, error = NULL, error_code = NULL, started_at = NULL, completed_at = NULL, report_state = 'none', report_attempts = 0, report_next_at = NULL, report_last_error = NULL", "state = 'failed' AND document_path IS NOT NULL AND cloud_job_id IS NULL");

    /// <summary>SET fragment that queues a cloud job's final report.</summary>
    private const string PendingReport =
        "report_state = CASE WHEN cloud_job_id IS NOT NULL THEN 'pending' ELSE report_state END, report_attempts = 0, report_next_at = NULL";

    private JobDto? Update(string id, string set, string predicate, params (string Name, object? Value)[] values)
    {
        using var connection = Open();
        var now = Now();
        using var command = connection.CreateCommand();
        command.CommandText = $"UPDATE jobs SET {set}, updated_at = $now WHERE id = $id AND {predicate}";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$now", now);
        foreach (var (name, value) in values)
        {
            command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        }

        if (command.ExecuteNonQuery() == 0)
        {
            return Get(id);
        }

        return Get(id);
    }

    private SqliteConnection Open()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        Execute(connection, "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
        return connection;
    }

    private static void Execute(SqliteConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    private static void EnsureColumn(SqliteConnection connection, string column, string definition)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA table_info(jobs)";
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }
        Execute(connection, $"ALTER TABLE jobs ADD COLUMN {column} {definition}");
    }

    private static void Execute(SqliteConnection connection, SqliteTransaction transaction, string sql, params (string Name, object? Value)[] values)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        foreach (var (name, value) in values)
        {
            command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        }
        command.ExecuteNonQuery();
    }

    private static JobDto? QuerySingle(SqliteConnection connection, SqliteTransaction? transaction, string sql, params (string Name, object? Value)[] values)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        foreach (var (name, value) in values)
        {
            command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        }
        using var reader = command.ExecuteReader();
        return reader.Read() ? Read(reader) : null;
    }

    private static long ScalarLong(SqliteConnection connection, SqliteTransaction transaction, string sql)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        return Convert.ToInt64(command.ExecuteScalar());
    }

    private static JobDto Read(SqliteDataReader reader) => new(
        reader.GetString(reader.GetOrdinal("id")),
        reader.GetString(reader.GetOrdinal("state")),
        Text(reader, "printer_id"),
        Text(reader, "document_name"),
        reader.GetInt32(reader.GetOrdinal("copies")),
        reader.GetInt64(reader.GetOrdinal("created_at")),
        Text(reader, "error"),
        Text(reader, "cloud_job_id"),
        reader.GetInt32(reader.GetOrdinal("pages_total")),
        reader.GetInt32(reader.GetOrdinal("pages_printed")),
        reader.GetInt32(reader.GetOrdinal("retry_count")),
        NullableInt(reader, "spooler_job_id"),
        reader.GetInt64(reader.GetOrdinal("updated_at")),
        NullableLong(reader, "started_at"),
        NullableLong(reader, "completed_at"),
        Text(reader, "document_path"),
        Text(reader, "cloud_order_id"),
        Text(reader, "cloud_document_id"),
        Text(reader, "lease_id"),
        Text(reader, "resolved_settings"),
        Text(reader, "report_state") ?? ReportStates.None,
        Text(reader, "cloud_shop_id"),
        Text(reader, "cloud_agent_id"),
        Text(reader, "error_code"),
        IntOrDefault(reader, "report_attempts"));

    private static string? Text(SqliteDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);
        return reader.IsDBNull(index) ? null : reader.GetString(index);
    }

    private static int IntOrDefault(SqliteDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);
        return reader.IsDBNull(index) ? 0 : reader.GetInt32(index);
    }

    private static int? NullableInt(SqliteDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);
        return reader.IsDBNull(index) ? null : reader.GetInt32(index);
    }

    private static long? NullableLong(SqliteDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);
        return reader.IsDBNull(index) ? null : reader.GetInt64(index);
    }

    private static long Now() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}
