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
        // A prior agent process cannot still be printing after a crash. Surface those
        // records for deliberate operator retry instead of silently duplicating output.
        Execute(connection, """
            UPDATE jobs
            SET state = 'failed',
                error = COALESCE(error, 'Agent restarted while print execution was in progress'),
                updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000,
                completed_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
            WHERE state = 'printing';
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
              id, cloud_job_id, idempotency_key, printer_id, document_name, document_path,
              document_sha256, resolved_settings, copies, pages_total, state, created_at, updated_at
            ) VALUES (
              $id, $cloudJobId, $idempotencyKey, $printerId, $documentName, $documentPath,
              $documentSha256, $resolvedSettings, $copies, $pagesTotal, 'queued', $now, $now
            )
            """,
            ("$id", id),
            ("$cloudJobId", request.CloudJobId),
            ("$idempotencyKey", request.IdempotencyKey),
            ("$printerId", request.PrinterId),
            ("$documentName", request.DocumentName),
            ("$documentPath", request.DocumentPath),
            ("$documentSha256", request.DocumentSha256),
            ("$resolvedSettings", request.ResolvedSettings),
            ("$copies", Math.Max(1, request.Copies)),
            ("$pagesTotal", Math.Max(0, request.PagesTotal)),
            ("$now", now));
        transaction.Commit();
        return Get(id)!;
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

    public JobDto? Cancel(string id) =>
        Update(id, "state = 'cancelled', completed_at = $now", "state IN ('created', 'queued', 'failed')");

    public JobDto? ClaimNext()
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        var job = QuerySingle(
            connection,
            transaction,
            "SELECT * FROM jobs WHERE state = 'queued' AND document_path IS NOT NULL ORDER BY created_at LIMIT 1");
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
        Update(id, "state = 'completed', spooler_job_id = $spoolerJobId, completed_at = $now, error = NULL", "state = 'printing'", ("$spoolerJobId", spoolerJobId));

    public JobDto? Fail(string id, string reason) =>
        Update(id, "state = 'failed', error = $error, completed_at = $now", "state = 'printing'", ("$error", reason));

    public JobDto? Retry(string id) =>
        Update(id, "state = 'queued', retry_count = retry_count + 1, error = NULL, started_at = NULL, completed_at = NULL", "state = 'failed'");

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
        Text(reader, "document_path"));

    private static string? Text(SqliteDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);
        return reader.IsDBNull(index) ? null : reader.GetString(index);
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
