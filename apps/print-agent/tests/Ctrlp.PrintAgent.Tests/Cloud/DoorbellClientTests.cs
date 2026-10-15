using System.Net;
using Ctrlp.PrintAgent.Contracts;
using Ctrlp.PrintAgent.Core.Cloud;

namespace Ctrlp.PrintAgent.Tests.Cloud;

/// <summary>Implementation plan 10.6 #3, against a fake clock and a fake Realtime Database.</summary>
public sealed class DoorbellClientTests
{
    private static readonly TimeSpan Second = TimeSpan.FromSeconds(1);

    [Fact]
    public async Task ConnectsWithTheSeededTokenAndReconnectsAtOnceAfterAHealthyStreamDrops()
    {
        await using var h = new DoorbellHarness();
        h.Start();

        var first = await h.WaitForStreamAsync(1);
        Assert.Equal("/doorbell/shop-1.json", h.LastStream.Uri.AbsolutePath);
        Assert.Equal(h.SeededToken, h.LastStream.Auth);
        first.Put(new { boardAt = 1, workAt = 1 });
        await h.WaitForEventsAsync("put", 1);
        Assert.Equal(DoorbellStates.Connected, h.Status.Current.Doorbell);

        h.Time.Advance(TimeSpan.FromSeconds(10));
        first.Fail(); // connection reset after a healthy 10 s

        var second = await h.WaitForStreamAsync(2); // no backoff: the clock didn't move
        Assert.Equal(0, h.TokenRequests);

        second.Put(new { boardAt = 2, workAt = 2 });
        await h.WaitForEventsAsync("put", 2);
        second.Fail(); // dropped within 5 s: broken, so back off
        await h.AdvanceThroughAsync(Second);
        await h.WaitForStreamAsync(3);
        Assert.Equal(0, h.PollRequests);
    }

    [Fact]
    public async Task WatchdogFiresAfter65SecondsWithoutAnEvent()
    {
        await using var h = new DoorbellHarness();
        h.Start();
        var first = await h.WaitForStreamAsync(1);
        first.Put(new { boardAt = 1 });
        await h.WaitForEventsAsync("put", 1);

        h.Time.Advance(TimeSpan.FromSeconds(30));
        first.KeepAlive();
        await h.WaitForEventsAsync("keep-alive", 1);
        h.Time.Advance(TimeSpan.FromSeconds(64)); // 64 s since the keep-alive
        Assert.Equal(1, h.StreamRequests);
        Assert.False(first.Disposed);

        h.Time.Advance(Second); // 65 s of silence
        await DoorbellHarness.Eventually(() => first.Disposed, "the watchdog closes the stream");
        await DoorbellHarness.Eventually(() => h.Status.Current.Doorbell == DoorbellStates.Connecting);
        await h.AdvanceThroughAsync(Second); // a watchdog end is broken: back off 1 s
        await h.WaitForStreamAsync(2);
    }

    [Fact]
    public async Task AuthRevokedWithAFreshCachedTokenReconnectsWithoutARefresh()
    {
        await using var h = new DoorbellHarness();
        h.Start(tokenLeft: TimeSpan.FromMinutes(50)); // the 55-minute refresh already happened
        var first = await h.WaitForStreamAsync(1);
        first.Put(new { boardAt = 1 });
        first.Send("auth_revoked", "\"credential is no longer valid\"");

        await h.WaitForStreamAsync(2);

        Assert.Equal(0, h.TokenRequests);
        Assert.Equal(h.SeededToken, h.LastStream.Auth);
        Assert.True(first.Disposed);
    }

    [Fact]
    public async Task AuthRevokedWithANearlyExpiredTokenRefreshesBeforeReconnecting()
    {
        await using var h = new DoorbellHarness();
        h.Start(tokenLeft: TimeSpan.FromMinutes(4));
        var first = await h.WaitForStreamAsync(1);
        Assert.Equal(h.SeededToken, h.LastStream.Auth);
        first.Put(new { boardAt = 1 });
        first.Send("auth_revoked", "\"credential is no longer valid\"");

        await h.WaitForStreamAsync(2);

        Assert.Equal(1, h.TokenRequests);
        Assert.Equal(TestTokens.Jwt("refreshed-1"), h.LastStream.Auth);
    }

    [Fact]
    public async Task UnreachableFor40SecondsNeverFallsBackAndReconnectsAsSoonAsTheNetworkReturns()
    {
        await using var h = new DoorbellHarness();
        var offline = false;
        h.OnStream = _ => offline ? throw new HttpRequestException("No such host is known.") : h.OpenStream().Response();
        h.Start();
        var first = await h.WaitForStreamAsync(1);
        first.Put(new { boardAt = 1 });
        await h.WaitForEventsAsync("put", 1);
        h.Time.Advance(TimeSpan.FromSeconds(10));

        offline = true;
        first.Fail();
        await DoorbellHarness.Eventually(() => h.StreamRequests == 2); // the immediate retry fails
        var waited = TimeSpan.Zero;
        foreach (var seconds in new[] { 1, 2, 4, 8, 16 })
        {
            await h.AdvanceThroughAsync(TimeSpan.FromSeconds(seconds));
            waited += TimeSpan.FromSeconds(seconds);
            await DoorbellHarness.Eventually(() => h.StreamRequests == 2 + (int)Math.Log2(seconds) + 1);
        }

        await h.Time.WaitForTimerAsync(TimeSpan.FromSeconds(32));
        Assert.Equal(DoorbellStates.Offline, h.Status.Current.Doorbell);
        h.Time.Advance(TimeSpan.FromSeconds(40) - waited); // the outage lasts 40 s
        offline = false;
        h.Doorbell.Wake("network available", closeStream: false); // what ConnectivityMonitor does

        var back = await h.WaitForStreamAsync(2); // no clock movement: back within 0 s
        back.Put(new { boardAt = 2 });
        await h.WaitForEventsAsync("put", 2);
        Assert.Equal(DoorbellStates.Connected, h.Status.Current.Doorbell);
        Assert.Equal(0, h.PollRequests);
    }

    [Fact]
    public async Task ThreeBrokenStreamsSwitchToPollingFor30MinutesThenBackToTheStream()
    {
        await using var h = new DoorbellHarness();
        h.OnStream = attempt => attempt switch
        {
            1 or 2 => new HttpResponseMessage(HttpStatusCode.InternalServerError),
            _ => h.OpenStream().Response(), // 200 but nothing ever arrives: what a buffering proxy looks like
        };
        h.OnPoll = () => TestTokens.Json(HttpStatusCode.OK, new { boardAt = 5, workAt = 5 });
        h.Start();

        await DoorbellHarness.Eventually(() => h.StreamRequests == 1);
        await h.AdvanceThroughAsync(Second);
        await DoorbellHarness.Eventually(() => h.StreamRequests == 2);
        await h.AdvanceThroughAsync(TimeSpan.FromSeconds(2));
        await h.WaitForStreamAsync(1);
        await h.AdvanceThroughAsync(TimeSpan.FromSeconds(65)); // the third one stalls until the watchdog

        await DoorbellHarness.Eventually(() => h.PollRequests == 1, "polling starts at once");
        Assert.Equal(DoorbellStates.Polling, h.Status.Current.Doorbell);
        await DoorbellHarness.Eventually(() => h.Sync.Count == 1, "the polled workAt counts like a streamed one");
        for (var poll = 2; poll <= 30; poll++)
        {
            await h.AdvanceThroughAsync(TimeSpan.FromSeconds(60));
            await DoorbellHarness.Eventually(() => h.PollRequests == poll);
        }

        Assert.Equal(3, h.StreamRequests);
        await h.AdvanceThroughAsync(TimeSpan.FromSeconds(60)); // 30 minutes since the fallback started
        await DoorbellHarness.Eventually(() => h.StreamRequests == 4, "the stream is tried again");
        Assert.Equal(30, h.PollRequests);
        Assert.Equal(1, h.Sync.Count);
    }

    [Fact]
    public async Task AHealthyConnectionResetsTheBrokenCount()
    {
        await using var h = new DoorbellHarness();
        h.OnStream = attempt => attempt == 3
            ? h.OpenStream().Response()
            : new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
        h.Start();

        await DoorbellHarness.Eventually(() => h.StreamRequests == 1);
        await h.AdvanceThroughAsync(Second);
        await DoorbellHarness.Eventually(() => h.StreamRequests == 2);
        await h.AdvanceThroughAsync(TimeSpan.FromSeconds(2));
        var healthy = await h.WaitForStreamAsync(1);
        healthy.Put(new { boardAt = 1 });
        await h.WaitForEventsAsync("put", 1);
        h.Time.Advance(TimeSpan.FromSeconds(10));
        healthy.End();

        // Two more broken attempts after the healthy one: 2 in a row, not 4, so still streaming.
        await DoorbellHarness.Eventually(() => h.StreamRequests == 4);
        await h.AdvanceThroughAsync(Second); // backoff was reset to 1 s too
        await DoorbellHarness.Eventually(() => h.StreamRequests == 5);
        Assert.Equal(0, h.PollRequests); // without the reset, attempt 4 would have been the third broken
        await h.AdvanceThroughAsync(TimeSpan.FromSeconds(2));
        await DoorbellHarness.Eventually(() => h.StreamRequests == 6);

        await DoorbellHarness.Eventually(() => h.PollRequests == 1, "the third in a row switches to polling");
    }

    [Fact]
    public async Task ANewerWorkAtSignalsSyncExactlyOncePerChange()
    {
        await using var h = new DoorbellHarness();
        h.Start();
        var first = await h.WaitForStreamAsync(1);

        first.Put(new { boardAt = 100, workAt = 100 });
        await h.WaitForEventsAsync("put", 1);
        Assert.Equal(1, h.Sync.Count); // the first value after a start syncs once

        first.Patch(new { boardAt = 101 });
        first.Patch(new { boardAt = 102, workAt = 101 });
        first.Patch(new { workAt = 50 });
        await h.WaitForEventsAsync("patch", 3);
        Assert.Equal(2, h.Sync.Count);

        // A reconnect re-reads the same value: nothing new to do.
        h.Time.Advance(TimeSpan.FromSeconds(10));
        first.End();
        var second = await h.WaitForStreamAsync(2);
        second.Put(new { boardAt = 102, workAt = 101 });
        await h.WaitForEventsAsync("put", 2);
        Assert.Equal(2, h.Sync.Count);

        var boards = await h.NotificationsAsync<BoardChangedNotification>(RpcNotifications.BoardChanged);
        Assert.Equal(new long[] { 100, 101, 102 }, boards.Select(board => board.BoardAt));
    }

    [Fact]
    public async Task AttentionIsRaisedOncePerNewOrderEvent()
    {
        await using var h = new DoorbellHarness();
        h.Start();
        var now = h.Time.GetUtcNow().ToUnixTimeMilliseconds();
        var first = await h.WaitForStreamAsync(1);

        // Whatever rang last before the app started is old news.
        first.Put(new { boardAt = now - 3 * 3_600_000, workAt = 1, last = Last("order_submitted", "o1", "ORD-1") });
        first.Patch(new { boardAt = now, last = Last("order_submitted", "o2", "ORD-2") });
        first.Patch(new { boardAt = now + 1, last = Last("order_updated", "o2", "ORD-2") });
        first.Patch(new { boardAt = now + 2, last = Last("order_submitted", "o2", "ORD-2") }); // seen
        first.Patch(new { boardAt = now + 3, last = Last("order_paid", "o2", "ORD-2") });
        first.Patch(new { boardAt = now + 4, last = Last("order_submitted", "o1", "ORD-1") }); // seen at start
        await h.WaitForEventsAsync("patch", 5);

        // Reconnects carry the same last event again.
        h.Time.Advance(TimeSpan.FromSeconds(10));
        first.End();
        var second = await h.WaitForStreamAsync(2);
        second.Put(new { boardAt = now + 4, workAt = 1, last = Last("order_submitted", "o1", "ORD-1") });
        await h.WaitForEventsAsync("put", 2);

        var attention = await h.NotificationsAsync<OrdersAttentionNotification>(RpcNotifications.OrdersAttention);
        Assert.Equal(
            new OrdersAttentionNotification[] { new("order_submitted", "o2", "ORD-2"), new("order_paid", "o2", "ORD-2") },
            attention);
    }

    [Fact]
    public async Task ARecentRingAtStartStillRaisesAttention()
    {
        await using var h = new DoorbellHarness();
        h.Start();
        var now = h.Time.GetUtcNow().ToUnixTimeMilliseconds();
        var first = await h.WaitForStreamAsync(1);

        first.Put(new { boardAt = now - 30_000, workAt = 1, last = Last("order_paid", "o9", "ORD-9") });
        await h.WaitForEventsAsync("put", 1);

        var attention = await h.NotificationsAsync<OrdersAttentionNotification>(RpcNotifications.OrdersAttention);
        Assert.Equal(new OrdersAttentionNotification[] { new("order_paid", "o9", "ORD-9") }, attention);
    }

    [Fact]
    public async Task CancelForcesARefreshAndCountsAsBroken()
    {
        await using var h = new DoorbellHarness();
        h.Start();
        var first = await h.WaitForStreamAsync(1);
        first.Put(new { boardAt = 1 });
        h.Time.Advance(TimeSpan.FromSeconds(10));
        first.Send("cancel", "\"Permission denied\"");

        await DoorbellHarness.Eventually(() => h.Status.Current.Doorbell != DoorbellStates.Connected);
        await h.AdvanceThroughAsync(Second); // broken, even after 10 s up
        await h.WaitForStreamAsync(2);
        Assert.Equal(1, h.TokenRequests);
        Assert.Equal(TestTokens.Jwt("refreshed-1"), h.LastStream.Auth);
    }

    [Fact]
    public async Task ARejectedTokenRefreshesAndNeverCountsTowardPolling()
    {
        await using var h = new DoorbellHarness();
        h.OnStream = attempt => attempt <= 4
            ? TestTokens.Json(HttpStatusCode.Unauthorized, new { error = "Auth token is expired" })
            : h.OpenStream().Response();
        h.Start();

        await DoorbellHarness.Eventually(() => h.StreamRequests == 1);
        foreach (var seconds in new[] { 1, 2, 4, 8 })
        {
            await h.AdvanceThroughAsync(TimeSpan.FromSeconds(seconds));
        }

        await h.WaitForStreamAsync(1);
        Assert.Equal(4, h.TokenRequests); // a forced refresh before each retry
        Assert.Equal(0, h.PollRequests);
    }

    [Fact]
    public async Task AnInvalidTokenStopsTheDoorbellUntilANewSession()
    {
        await using var h = new DoorbellHarness();
        h.OnRefresh = _ => TestTokens.GoogleError(400, "TOKEN_EXPIRED");
        h.Start(seed: false);

        // Connecting is set before the token is asked for, so offline here means the doorbell gave up.
        await DoorbellHarness.Eventually(() =>
            h.Status.Current is { Token: TokenStates.Invalid, Doorbell: DoorbellStates.Offline } &&
            h.Http.Count(request => request.IsToken) == 1);
        Assert.Equal(0, h.StreamRequests);
        Assert.Empty(h.Time.PendingTimers()); // stopped, not retrying

        // The operator signs in again on this PC.
        h.Secrets.SetRefreshToken("refresh-2");
        h.Tokens.Seed(h.SeededToken, h.Time.GetUtcNow().AddMinutes(60));
        h.Context.SetSession(new CloudSession("shop-1", "agent-1"));

        await h.WaitForStreamAsync(1);
        Assert.Equal(h.SeededToken, h.LastStream.Auth);
    }

    [Fact]
    public async Task ResumeFromSleepClosesTheStreamAndReconnectsAtOnce()
    {
        await using var h = new DoorbellHarness();
        h.Start();
        var first = await h.WaitForStreamAsync(1);
        first.Put(new { boardAt = 1 });
        await h.WaitForEventsAsync("put", 1);

        h.Doorbell.Wake("resume", closeStream: true);

        await h.WaitForStreamAsync(2);
        Assert.True(first.Disposed);
    }

    [Fact]
    public async Task FollowsTheSessionAndStopsOnClear()
    {
        await using var h = new DoorbellHarness();
        h.Start();
        var first = await h.WaitForStreamAsync(1);
        first.Put(new { boardAt = 1, workAt = 7 });
        await h.WaitForEventsAsync("put", 1);

        // The same session again (agent:ready) changes nothing.
        h.Context.SetSession(new CloudSession("shop-1", "agent-1"));
        h.Context.SetSession(new CloudSession("shop-2", "agent-9"));
        var second = await h.WaitForStreamAsync(2);
        Assert.Equal("/doorbell/shop-2.json", h.LastStream.Uri.AbsolutePath);
        Assert.True(first.Disposed);
        second.Put(new { boardAt = 1, workAt = 7 });
        await h.WaitForEventsAsync("put", 2);
        Assert.Equal(2, h.Sync.Count); // a new shop starts fresh

        h.Context.ClearSession();
        await DoorbellHarness.Eventually(() => second.Disposed);
        await DoorbellHarness.Eventually(() => h.Status.Current.Doorbell == DoorbellStates.Offline);
        Assert.Equal(2, h.StreamRequests);
    }

    [Fact]
    public void KeepsTheEmulatorNamespaceInTheUrl()
    {
        var uri = DoorbellClient.DoorbellUri(
            new DoorbellClient.DoorbellTarget("http://127.0.0.1:9000?ns=meetctrlp-default-rtdb", "shop 1"),
            "a.b.c");

        Assert.Equal("http://127.0.0.1:9000/doorbell/shop%201.json?ns=meetctrlp-default-rtdb&auth=a.b.c", uri.AbsoluteUri);
    }

    [Theory]
    [InlineData(5, 5, false)]
    [InlineData(7, 7, false)] // a slow tick is not a resume
    [InlineData(1800, 5, true)] // the wall clock jumped 30 minutes: the PC slept
    [InlineData(300, 300, true)] // the monotonic clock counted the sleep too
    public void DetectsResumeFromTheClocks(int wallSeconds, int monoSeconds, bool resumed)
    {
        Assert.Equal(
            resumed,
            ConnectivityMonitor.IsResume(
                TimeSpan.FromSeconds(wallSeconds),
                TimeSpan.FromSeconds(monoSeconds),
                ConnectivityMonitor.TickInterval));
    }

    private static object Last(string type, string orderId, string orderNumber) => new { type, orderId, orderNumber };
}
