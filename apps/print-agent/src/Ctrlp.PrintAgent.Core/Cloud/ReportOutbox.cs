using System.Net;
using System.Text.Json;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Core.Cloud;

/// <summary>Wakes the outbox: a job finished, or a report became due.</summary>
public interface IReportSignal
{
    void Signal();
}

/// <summary>
/// Sends one final report per finished cloud job to <c>POST .../agents/{agentId}/jobs/report</c>
/// (implementation plan 10.5). Reports live in SQLite (<c>report_state</c>), so none is lost to a crash or
/// an outage. It batches up to 20, backs off on failure, and sends only the active shop and agent's reports.
/// Timers run only while reports are pending.
/// </summary>
public sealed class ReportOutbox : IReportSignal
{
    public const int BatchSize = 20;

    /// <summary>The server's limit for <c>pagesPrinted</c> (packages/schemas agent-sync.ts); one report above it 400s its batch.</summary>
    public const int MaxPagesPrinted = 100_000;

    internal static readonly TimeSpan GatherDelay = TimeSpan.FromSeconds(1);
    internal static readonly TimeSpan MinBackoff = TimeSpan.FromSeconds(1);
    internal static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly IJobStore _jobs;
    private readonly AgentCloudContext _context;
    private readonly CloudApiClient _api;
    private readonly CloudStatus _status;
    private readonly TimeProvider _time;
    private readonly Action<string>? _log;
    private readonly Random _random;
    private readonly AsyncSignal _signal = new();

    public ReportOutbox(
        IJobStore jobs,
        AgentCloudContext context,
        CloudApiClient api,
        CloudStatus status,
        TimeProvider? time = null,
        Action<string>? log = null,
        Random? random = null)
    {
        _jobs = jobs;
        _context = context;
        _api = api;
        _status = status;
        _time = time ?? TimeProvider.System;
        _log = log;
        _random = random ?? Random.Shared;
        // A new session may be the shop whose reports are waiting: flush on every session.
        _context.SessionRenewed += Signal;
        _context.Changed += Signal;
    }

    public void Signal() => _signal.Set();

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var failures = 0;
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var session = _context.Session;
                if (session is null || _context.Config is null)
                {
                    await _signal.WaitAsync(cancellationToken).ConfigureAwait(false);
                    continue;
                }

                var now = NowMs();
                var due = _jobs.DueReports(session.ShopId, session.AgentId, now, BatchSize);
                if (due.Count == 0)
                {
                    PublishPending(session);
                    var next = _jobs.NextReportAt(session.ShopId, session.AgentId);
                    if (next is null)
                    {
                        await _signal.WaitAsync(cancellationToken).ConfigureAwait(false);
                    }
                    else
                    {
                        await _signal.WaitAsync(TimeSpan.FromMilliseconds(Math.Max(1, next.Value - now)), _time, cancellationToken)
                            .ConfigureAwait(false);
                    }
                    continue;
                }

                if (due.Count < BatchSize)
                {
                    // Several jobs of one order often finish together: send them in one request.
                    await Task.Delay(GatherDelay, _time, cancellationToken).ConfigureAwait(false);
                    due = _jobs.DueReports(session.ShopId, session.AgentId, NowMs(), BatchSize);
                }

                var failure = await SendAsync(due, cancellationToken).ConfigureAwait(false);
                if (failure is null)
                {
                    failures = 0;
                }
                else
                {
                    failures++;
                    var delay = failure.RetryAfter ?? Backoff(failures);
                    var retryAt = NowMs() + (long)delay.TotalMilliseconds;
                    foreach (var job in due)
                    {
                        _jobs.DeferReport(job.Id, retryAt, failure.Reason);
                    }
                    _log?.Invoke($"cloud reports deferred count={due.Count} for={delay.TotalSeconds:0.#}s reason={failure.Reason}");
                }

                PublishPending(session);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                _log?.Invoke($"cloud report loop failed: {exception.GetType().Name}: {exception.Message}");
                failures++;
                try
                {
                    await _signal.WaitAsync(Backoff(failures), _time, cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    return;
                }
            }
        }
    }

    internal sealed record SendFailure(string Reason, TimeSpan? RetryAfter);

    /// <summary>Sends one batch. Returns null when the server answered for each report.</summary>
    internal async Task<SendFailure?> SendAsync(IReadOnlyList<JobDto> due, CancellationToken cancellationToken)
    {
        var session = _context.Session;
        if (session is null)
        {
            return new SendFailure("no session", null);
        }

        var reportable = new List<JobDto>();
        var reports = new List<object>();
        foreach (var job in due)
        {
            var report = ToReport(job);
            if (report is null)
            {
                // Without its order, job or lease the server can't place it; it would never be accepted.
                _jobs.SetReportState(job.Id, ReportStates.Rejected);
                continue;
            }
            reportable.Add(job);
            reports.Add(report);
        }
        if (reports.Count == 0)
        {
            return null;
        }

        HttpResponseMessage response;
        try
        {
            response = await _api.SendAsync(
                HttpMethod.Post,
                $"/api/v1/shops/{Uri.EscapeDataString(session.ShopId)}/agents/{Uri.EscapeDataString(session.AgentId)}/jobs/report",
                JsonSerializer.Serialize(new { reports }, Json),
                cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (TokenInvalidException exception)
        {
            return new SendFailure(exception.Message, MaxBackoff);
        }
        catch (Exception exception)
        {
            return new SendFailure($"{exception.GetType().Name}: {exception.Message}", null);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode == HttpStatusCode.BadRequest)
                {
                    if (reportable.Count > 1)
                    {
                        // The server validates the whole batch, so one bad report fails all of them. Send each
                        // on its own: only the bad one is rejected, and the rest are settled as usual.
                        _log?.Invoke($"cloud reports status=400 count={reportable.Count}; resending one at a time");
                        foreach (var job in reportable)
                        {
                            var failure = await SendAsync([job], cancellationToken).ConfigureAwait(false);
                            if (failure is not null)
                            {
                                // The server or network failed: keep this and the unsent reports for the backoff.
                                return failure;
                            }
                        }
                        return null;
                    }

                    // A malformed report never gets better by resending it.
                    _jobs.SetReportState(reportable[0].Id, ReportStates.Rejected);
                    _log?.Invoke($"cloud report rejected status=400 job={reportable[0].CloudJobId}");
                    return null;
                }

                return new SendFailure($"status {(int)response.StatusCode}", RetryAfter(response));
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var parsed = JsonSerializer.Deserialize<ReportResponse>(body, Json);
            var results = parsed?.Results?.ToDictionary(result => result.JobId, result => result.Result, StringComparer.Ordinal)
                ?? new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var job in reportable)
            {
                switch (results.GetValueOrDefault(job.CloudJobId!))
                {
                    case "ok":
                        _jobs.SetReportState(job.Id, ReportStates.Acked);
                        break;
                    case "lease_mismatch" or "invalid_state" or "not_found":
                        _log?.Invoke($"cloud report rejected job={job.CloudJobId} result={results[job.CloudJobId!]}");
                        _jobs.SetReportState(job.Id, ReportStates.Rejected);
                        break;
                    default:
                        // "retry" (the file couldn't be deleted yet) or no answer for this job.
                        _jobs.DeferReport(job.Id, NowMs() + (long)Backoff(job.ReportAttempts + 1).TotalMilliseconds, "retry");
                        break;
                }
            }
        }

        return null;
    }

    internal static object? ToReport(JobDto job)
    {
        if (string.IsNullOrWhiteSpace(job.CloudJobId) || string.IsNullOrWhiteSpace(job.CloudOrderId) ||
            string.IsNullOrWhiteSpace(job.LeaseId))
        {
            return null;
        }

        var status = job.State switch
        {
            "completed" => "COMPLETED",
            "failed" => "FAILED",
            "cancelled" => "CANCELLED",
            _ => null,
        };
        if (status is null)
        {
            return null;
        }

        var error = string.IsNullOrWhiteSpace(job.Error) ? null : job.Error.Length > 500 ? job.Error[..500] : job.Error;
        var pagesPrinted = status == "COMPLETED" ? Math.Max(job.PagesPrinted, job.PagesTotal) : job.PagesPrinted;
        return new
        {
            orderId = job.CloudOrderId,
            jobId = job.CloudJobId,
            leaseId = job.LeaseId,
            status,
            pagesPrinted = Math.Clamp(pagesPrinted, 0, MaxPagesPrinted),
            spoolerJobId = job.SpoolerJobId is > 0 ? job.SpoolerJobId : null,
            errorCode = status == "FAILED" ? job.ErrorCode ?? "AGENT_EXECUTION_FAILED" : null,
            errorMessage = status == "FAILED" ? error : null,
        };
    }

    /// <summary>1 s doubling to 5 minutes, with ±20% jitter.</summary>
    internal TimeSpan Backoff(int failures)
    {
        var seconds = Math.Min(MaxBackoff.TotalSeconds, MinBackoff.TotalSeconds * Math.Pow(2, Math.Max(0, failures - 1)));
        return TimeSpan.FromSeconds(seconds * (0.8 + _random.NextDouble() * 0.4));
    }

    private static TimeSpan? RetryAfter(HttpResponseMessage response)
    {
        var header = response.Headers.RetryAfter;
        if (header?.Delta is { } delta)
        {
            return delta < MaxBackoff ? delta : MaxBackoff;
        }
        return null;
    }

    private void PublishPending(CloudSession session)
    {
        var count = _jobs.CountPendingReports(session.ShopId, session.AgentId);
        _status.Update(state => state with { PendingReports = count });
    }

    private long NowMs() => _time.GetUtcNow().ToUnixTimeMilliseconds();

    private sealed record ReportResponse(IReadOnlyList<ReportResult>? Results);

    private sealed record ReportResult(string JobId, string Result);
}
