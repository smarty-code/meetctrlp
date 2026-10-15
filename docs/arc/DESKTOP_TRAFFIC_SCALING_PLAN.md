# Desktop traffic and server load: diagnosis and plan

> **Status:** Proposed, 15 Oct 2026. Nothing in this document is implemented yet.
> **Hosting:** Firebase App Hosting (serverless), decided 15 Oct 2026. See 7.4 and [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md).
> **Scope:** `apps/server`, `apps/print-shop` (desktop UI), `apps/print-agent` (C# agent), and the order-tracking page in `apps/printUserWebapp`.
> **Problem:** every open shop desktop sends two server requests every 30 seconds, each request does slow and billable work, and the order stream re-reads the shop's whole history. Server load and Firestore cost grow with every installed desktop, even when no orders arrive.

The numbers come from reading the code and one development server log. Section 15 lists what has not been verified.

---

## 1. Summary

- An idle desktop (UI and agent running) sends a heartbeat and a job poll every 30 seconds.
  - Each heartbeat makes one HTTPS call to Google to check the login token, then five Firestore calls in a row.
  - Each job poll makes two Firestore calls.
- At 1,000 idle desktops that is about 67 requests/s, 17 million Firestore reads and 2.9 million writes a day, and roughly $235–470/month for traffic that does nothing useful.
- Bigger hidden costs:
  - The order stream re-reads every order and print job the shop has ever had on each reconnect, and keeps them in server memory.
  - After one hour the desktop's login token expires and the desktop retries failed requests every 10 seconds.
- The plan has three phases:
  - **Phase 1 changes only the server**, so it also helps desktops that can't be updated. It brings idle cost at 1,000 desktops to about $16–32/month.
  - **Phase 2** updates the desktop app and the agent.
  - **Phase 3** replaces polling with push.

---

## 2. What the development log showed

The server log of one running desktop contains only two requests, alternating:

| Request | Typical time | Spikes |
| --- | --- | --- |
| `POST /api/v1/devices/heartbeat` | 1.1–1.4 s | 17 s, 18 s, 32 s |
| `GET /api/v1/shops/{shopId}/agents/{agentId}/jobs?limit=10` | 0.4–0.65 s | 7 s, 20 s |

- **Idle state:** one heartbeat per poll means both run on 30-second cycles. No claims or reports appear, so the agent was not in its 3-second busy mode.
- **Overlapping heartbeats:** two heartbeats appear back to back. The desktop sends one every 30 s with `setInterval`, which doesn't wait for the previous one, so a 32 s heartbeat overlaps the next.
- **Shared stall:** the spikes hit both requests at the same moment, so something they share stalled: the single `next dev` process, the network, or the Node event loop. Request volume alone doesn't produce that pattern.
- **Round-trip time:** the steady times fit about 200 ms per Firestore call from the development machine. That suggests the database region is far from that machine.

---

## 3. Where the load comes from

### 3.1 Cost of each request

| Request | Sent by | How often | Work, in order | Firestore |
| --- | --- | --- | --- | --- |
| Heartbeat | Desktop UI ([`App.tsx`](../../apps/print-shop/src/App.tsx)) | Every 30 s | Token check over HTTPS to Google (`accounts:lookup`); read `authLookups/*`; read the shop user; read the agent; write the agent; query every ONLINE agent in the shop | 4 reads, 1 write |
| Job poll | C# agent ([`AgentCloudSynchronizer.cs`](../../apps/print-agent/src/Ctrlp.PrintAgent.Core/Cloud/AgentCloudSynchronizer.cs)) | 30 s when idle, 3 s when busy | Read the agent (credential check); collection-group query for queued jobs | 2 reads |

### 3.2 Causes

1. **Token check over the network.**
   - `requireShopUser` in [`auth.service.ts`](../../apps/server/src/modules/auth/auth.service.ts) calls `lookupIdToken` in [`auth-rest.ts`](../../packages/firebase/src/auth-rest.ts). That is an HTTPS request to Google Identity Toolkit.
   - It then makes two Firestore reads (`findByLookup` in [`firestore-shop-store.ts`](../../apps/server/src/modules/shops/firestore-shop-store.ts)).
   - Every shop request pays both costs.
2. **The heartbeat does maintenance work.** `recordDeviceHeartbeat` in [`device.service.ts`](../../apps/server/src/modules/devices/device.service.ts) reads before it writes, and runs `markStaleAgentsOffline` (a query over the shop's agents) on every beat. Nothing in the server, desktop or admin app reads agent `status` or `lastSeenAt`, so this work has no consumer.
3. **Polling instead of push.** The agent asks for jobs on a timer, even though the server already watches the shop's print jobs for the order stream.
4. **Clients ignore the server's interval.** The server returns `heartbeatIntervalSeconds`, but the desktop hard-codes 30 s, so the server has no way to slow clients down.
5. **Overlapping heartbeats.** `setInterval` fires whether or not the last heartbeat finished. A slow server therefore receives more heartbeats, not fewer.

---

## 4. Costs not visible in the log

### 4.1 The order stream re-reads the shop's whole history

Each open desktop holds one `GET /api/v1/shops/{shopId}/orders/stream` connection.

- **Per connection, two unbounded listeners:** for each connection, `subscribeShopOrders` in [`order.service.ts`](../../apps/server/src/modules/orders/order.service.ts) opens two Firestore listeners with no limit, one over all of the shop's orders and one over all of its print jobs.
- **Every reconnect re-reads both in full.**
- **Startup:** the desktop also calls `listShopOrders` (all orders) when it starts.
- **Memory:** everything the listeners match stays in server memory.

Example shop: 100 orders a day, 2 files per order. After 90 days it has 9,000 orders and 18,000 print jobs.

- Each reconnect costs about 27,000 reads.
- Each app launch costs about 36,000 reads.
- Each connected desktop holds about 40 MB on the server, assuming about 1.5 KB per document.

All three keep growing for as long as the shop takes orders.

### 4.2 Request storm after the login token expires

The desktop gets a new ID token only when it starts, and Firebase ID tokens last one hour. After that:

- every heartbeat fails;
- once the order stream drops for any reason, it retries every 10 seconds forever (`streamShopOrders` in [`cloud.ts`](../../apps/print-shop/src/lib/cloud.ts)), and each attempt is another failed token check with Google;
- the desktop silently stops receiving new orders.

That comes to about 8 failing requests per minute per desktop. This was found by reading the code and has not been reproduced yet; the session in the log was probably under an hour old.

### 4.3 The agent can get stuck polling every 3 seconds

The agent switches to a 3-second cycle whenever a poll returns any job, or any final job report is still unconfirmed. It does this even when no progress is possible, for example a claim that keeps failing.

Since the 14 Oct 2026 change, a job counts as acknowledged only once its final report is accepted. As a result, a final report that the server permanently rejects (404 or 409) is re-sent every 3 seconds forever.

### 4.4 Silent fallback to a heavier job query

If the collection-group index for the job query isn't deployed, `listAgentPrintJobs` in [`print-job.service.ts`](../../apps/server/src/modules/printing/print-job.service.ts) catches the error silently. It then reads every active order and each order's jobs on every poll. Whether the index is deployed is unknown.

### 4.5 Customer order tracking

The tracking page polls every 6 seconds while it's open ([`tracking-constants.ts`](../../apps/printUserWebapp/src/data/tracking-constants.ts)). Each poll reads:

- the guest session;
- the order;
- the order's entire `statusHistory` subcollection, which the web app never uses.

That is about 3–7 reads per poll, or 30–70 reads per minute per waiting customer.

---

## 5. Estimates at scale (current code)

Assumptions:

- the desktop UI and agent are open all day;
- the shop is idle (no orders);
- one PC per shop;
- latencies are from the development log;
- Firestore costs $0.03–0.06 per 100k reads and $0.09–0.18 per 100k writes. Check current pricing for your region.

Per desktop per day:

- 5,760 requests;
- 17,280 reads;
- 2,880 writes;
- 2,880 token checks with Google.

Firestore's free daily quota is 50,000 reads and 20,000 writes, so about three idle desktops use up the whole free read quota.

| Desktops | Requests/s | Reads/day | Writes/day | Requests in flight* | Firestore cost/month |
| --- | --- | --- | --- | --- | --- |
| 100 | 7 | 1.7 M | 0.29 M | ~6 | ~$20–45 |
| 1,000 | 67 | 17 M | 2.9 M | ~57 | ~$235–470 |
| 10,000 | 667 | 173 M | 29 M | ~570 | ~$2.3k–4.7k |

\* Requests per second × current response time.

Not included:

- busy desktops: an agent in 3-second mode costs about 4× an idle one;
- order-stream reconnects (4.1);
- the token-expiry storm (4.2);
- customer tracking (4.5).

---

## 6. Target design

**Today:**

- every desktop pulls;
- every request pays for slow checks;
- every connection gets its own unbounded Firestore view.

**Target:**

- **Shop hub:** the server keeps one small in-memory view per shop. It holds active orders, today's closed orders and unfinished print jobs, kept current by three bounded Firestore listeners.
- **Served from memory, told about changes:** desktops and agents read from that view, and the server pushes changes to them.
- **No network calls on the common path:** tokens are checked locally, and users and agent credentials are cached.

```text
Firestore
   │  3 bounded listeners per shop: active orders, today's closed orders, unfinished jobs
   ▼
Shop hub  (one per shop, in server memory)
   ├──▶ Desktop UI        order stream (SSE): snapshot + changes, resumable after a reconnect
   ├──▶ Print agent       job list for polls (Phase 1); "jobs.available" push (Phase 3)
   └──▶ Customer web app  status of active orders

Writes (claim, report, accept, payment, ...) still go straight to Firestore in transactions.
The hub sees them through its listeners.
```

---

## 7. Phase 1: server only

None of these changes needs a desktop update.

### 7.1 Check login tokens locally and cache the user

**Where:** `requireShopUser` in [`auth.service.ts`](../../apps/server/src/modules/auth/auth.service.ts).

**Change:**

- **Verify the token locally:** replace `lookupIdToken` with `getFirebaseAuth().verifyIdToken(token)` from firebase-admin. `auth.service.ts` already imports `getFirebaseAuth`. It checks the token signature against Google's public keys, which it caches, so there is no network call per request.
- **Cache the shop user:** keep `firebaseUid → { shopId, userId, role, status }` in memory with a 5-minute TTL, up to about 10,000 entries, ACTIVE users only. Delete an entry when the server changes that user.
- **Cheaper cache misses:** use the token's custom claims (`shopId`, `shopUserId`, `role`) to read the user document directly, which is 1 read instead of 2. Owners get these claims at registration on a best-effort basis; tokens without them fall back to `findByLookup`.
- **Revocation on sensitive routes:** logout and staff changes call `verifyIdToken(token, true)`, which also checks revocation with one call to Google.

**Trade-off:** deactivating a staff member can take up to 5 minutes to reach other server instances.

**Effect:** every desktop request loses one call to Google (300–800 ms) and two Firestore reads. Expired tokens from installed desktops (4.2) are now rejected locally, with no call to Google and no reads, until Phase 2 stops those retries.

### 7.2 Make the heartbeat almost free

**Where:** `recordDeviceHeartbeat` in [`device.service.ts`](../../apps/server/src/modules/devices/device.service.ts).

**Changes:**

- **No read before writing:** `update()` the agent document directly. A missing document returns 404. The document path already contains the user's shop, so the separate shop check isn't needed.
- **Throttle the write:** write `lastSeenAt` at most every 5 minutes per agent, using an in-memory last-write time per server instance. Otherwise skip the write and still return 200.
- **Drop the stale-agent sweep:** remove `markStaleAgentsOffline` from the request path.
  - Add an `isAgentOnline(agent, now)` helper for future readers: online if `status` is ONLINE and `lastSeenAt` is under 10 minutes old.
  - Keep writing OFFLINE on sign-out.
- **Return `heartbeatIntervalSeconds: 120`.** Current desktops ignore it; Phase 2 desktops obey it.

**Effect:** from 4 reads and 1 write every 30 seconds to no reads and 1 write every 5 minutes.

### 7.3 Make agent requests cheap

**Where:** `requireAgentCredential` in [`device.service.ts`](../../apps/server/src/modules/devices/device.service.ts) and `listAgentPrintJobs` in [`print-job.service.ts`](../../apps/server/src/modules/printing/print-job.service.ts).

**Changes:**

- **Cache the agent's `apiKeyHash` for 5 minutes.** Today the poll, claim, ticket, report and shred routes all re-read the agent document. Rotating a credential would take up to 5 minutes to apply everywhere.
- **Serve the job list from the shop hub (7.4).** Claiming is still a Firestore transaction, so a list that's a second out of date is harmless; at worst the claim returns 409.
- **When no hub is available,** query ordered by `createdAt` using the index in appendix B. Log errors instead of silently switching to the per-order fallback.
- **Add `pollAfterSeconds` to the job-list response:** 3 when jobs were returned, 60 when the list is empty. Current agents ignore the field.

**Effect:** an idle poll makes no Firestore reads and takes a few milliseconds. Until the hub ships, it costs one read.

### 7.4 Shop hub: one shared, bounded live view per shop

New module: `apps/server/src/modules/realtime/shop-hub.ts`.

**Lifetime**

- One hub per shop per server instance, reference-counted by its users: order streams, agent polls, agent streams and tracking lookups.
- The hub stays alive for 10 minutes after its last user leaves, so reconnects and app restarts don't rebuild it.
- In `next dev`, store hubs on `globalThis` so hot reload doesn't create duplicate listeners.

**Listeners**

1. **Active orders:** `orders` where `status in [SUBMITTED, SHOP_ACCEPTED, PRINTING, READY]`.
2. **Today's closed orders:** `orders` where `status in [COMPLETED, REJECTED, CANCELLED]` and `updatedAt >= start of today` (Asia/Kolkata). Re-subscribed at midnight.
3. **Unfinished jobs:** collection group `printJobs` where `shopId ==` the shop and `status in [QUEUED, DISPATCHING, PRINTING, FAILED]`.

If a listener fails, for example because an index is missing, the hub marks itself unhealthy and logs the error. Callers then fall back to direct queries.

**State**

- Documents by id.
- A `version` number that increases with every change.
- An `epoch`: a random id per hub instance.
- A buffer of the last ~500 changes, for replay.

**Order stream** ([stream route](<../../apps/server/app/api/v1/shops/[shopId]/orders/stream/route.ts>), `subscribeShopOrders`)

- The stream subscribes to the hub instead of opening its own listeners.
- Every event carries `id: <epoch>.<version>`.
- On reconnect the client sends `Last-Event-ID`:
  - same epoch, and the version is still in the buffer: replay only the missed events;
  - otherwise: send `ORDERS_SNAPSHOT` from memory.
- Event types stay the same: `ORDERS_SNAPSHOT`, `ORDER_CREATED`, `ORDER_STATUS_CHANGED`, `PRINT_JOB_CHANGED`, `ping`.

**Effect**

- **Reconnect:** 0 reads while the hub is alive, about 100–300 when a hub is created, and the cost no longer grows with history.
- **Memory:** roughly 0.1–0.6 MB per active shop, instead of the full history per connected desktop.
- **Behaviour change:** the snapshot holds only the live window. Older orders come from the history API (8.4).

**Hosting:** the server runs on Firebase App Hosting (decision 1 in section 14), which runs it on Cloud Run. The hub still works there, with these rules (details in [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md)):

- **5-minute streams.** App Hosting ends every request after 5 minutes, so each desktop reconnects at least that often. `Last-Event-ID` replay is what keeps those reconnects cheap. Without the hub, each one re-reads the shop's history (4.1).
- **CPU only while a request is open.** By default an instance gets CPU only while it is handling a request. A hub whose last stream has closed stops receiving listener updates, so keep the grace period short (Appendix C). Don't rely on timers after a response ends.
- **One hub per instance.** Each instance builds its own hubs from Firestore, and a reconnect may land on a different instance. More instances means more hub builds per shop, so prefer fewer, larger instances. SSE streams use little memory.
- **Warm instance.** `minInstances: 1` keeps one warm instance so reconnects don't wait for a cold start.

### 7.5 Visibility and guard rails

- **Request logging:** log each request's timestamp, route and duration, plus the Firestore reads and writes it caused, using a small counter around the Firestore helpers. This confirms the savings and helps find the cause of the 17–32 s spikes.
- **Event-loop delay:** track it with `perf_hooks.monitorEventLoopDelay` and warn above ~200 ms. If PDF page counting or hashing of large uploads shows up, move that work to a worker thread.
- **Rate limits:** per device and per agent (for example 30 requests/min), answering 429 with `Retry-After`. This caps any client stuck in a loop.
- **Budget alert:** set a Firestore budget alert in Google Cloud.
- **Load testing:** run against a production build (`next start`) in the same region as Firestore, not `next dev` on a laptop.

---

## 8. Phase 2: desktop app and agent update

Ship the UI and agent changes together in one installer.

### 8.1 Keep the desktop's login token fresh

- **Proactive refresh:** refresh the ID token 5 minutes before it expires (`expiresIn`, 3600 s), using the stored refresh token.
- **On a 401:** run one shared refresh for all pending calls, then retry once. If the refresh fails, return to the login screen.
- **Keep the token out of effect dependencies:** hold it in a ref rather than in the dependencies of the order stream and heartbeat effects (`[idToken, user]` and `[idToken, deviceId]` in [`App.tsx`](../../apps/print-shop/src/App.tsx)). Otherwise every hourly refresh tears down the stream and forces a new snapshot.
- **Order-stream client** (`streamShopOrders` in [`cloud.ts`](../../apps/print-shop/src/lib/cloud.ts)):
  - on a 401, refresh the token before reconnecting;
  - add random jitter and cap the backoff at 30–60 s;
  - reset the backoff only after a connection has stayed up for 30 s;
  - send `Last-Event-ID` on reconnect.

**Effect:** removes the storm in 4.2 and the silent loss of new orders.

### 8.2 A heartbeat that can't pile up

- **Scheduling:** replace `setInterval` with a timer scheduled after the previous heartbeat finishes.
- **Interval:** use the server's `heartbeatIntervalSeconds`, add ±10% jitter, and back off to 5 minutes on errors.
- **Telemetry:** send it only when it changes, or every 5 minutes.

### 8.3 Agent backoff based on real progress

**Where:** `RunAsync` and `SynchronizeOnceAsync` in [`AgentCloudSynchronizer.cs`](../../apps/print-agent/src/Ctrlp.PrintAgent.Core/Cloud/AgentCloudSynchronizer.cs).

**Changes:**

- **Speed up only on progress:** switch to 3 s only when a job was claimed and staged, or a report was accepted. A 409 claim, a failed claim, or a failed report doesn't count.
- **Polling cadence:** use `pollAfterSeconds`, defaulting to 60 s with jitter when idle. Back off to 5 minutes on errors and honour `Retry-After`.
- **Per-job backoff:** back off failed claims and reports per job (in memory, `jobId → next attempt`).
- **Permanent rejections:** treat a final report rejected with 404 or 409 as permanent. Log it, mark the job acknowledged, and stop re-sending. Retry only network errors and 5xx. This closes 4.3.
- **Tests:** add unit tests for the synchronizer using a fake HTTP handler; it has none today.

### 8.4 Order history the desktop can page through

Today the Orders screen's All and Completed tabs, date picker and search all filter the full history in memory (`filterOrders` in [`dashboard.ts`](../../apps/print-shop/src/lib/dashboard.ts)). With the bounded stream, older orders come from the server instead.

**History:** `GET /api/v1/shops/{shopId}/orders?status=&date=&cursor=&limit=50`, newest first and paged.

- Requests that pass `limit` get paging.
- Requests without it keep today's full list until decision 2 is settled.

**Search:** `GET /api/v1/shops/{shopId}/orders/search?q=`.

- Matches exact order number, pickup code or phone.
- Matches filenames through a `searchKeys` array written when the order is created (lowercased order number, pickup code, phone, and filename words), queried with `array-contains`.
- A one-off script backfills `searchKeys` on existing orders.

**Desktop:**

- New, Active, Ready and today's Completed come from the stream.
- Older Completed, All, dates and search use these endpoints.
- Drop the full `listShopOrders` call at startup in [`App.tsx`](../../apps/print-shop/src/App.tsx); the stream snapshot replaces it.

---

## 9. Phase 3: push instead of poll

### 9.1 Agent stream

New endpoint: `GET /api/v1/shops/{shopId}/agents/{agentId}/stream`. It is SSE, authenticated with the device credential, and fed by the shop hub.

```text
event: jobs.available   data: {"jobIds":["…"]}                          a job for this agent became QUEUED
event: config           data: {"safetyPollSeconds":300,"serverTime":"…"}
event: ping             data: {}                                        every 20 s; keeps proxies from closing it
```

The agent runs one background task that keeps the stream open, reconnecting with jitter (1 s up to 60 s). App Hosting closes every stream after 5 minutes, so a clean end of stream is routine. Reconnect at once, without backoff and without showing an error. Back off only after a failed connect.

- **On `jobs.available` or after a reconnect,** it runs the existing claim-and-stage flow unchanged.
- **Safety poll:** every 5 minutes.
- **No separate heartbeat.**

### 9.2 Presence from the connection

- **Server writes:**
  - on connect, `status: ONLINE` and `lastSeenAt`. On App Hosting every stream reconnects within 5 minutes, so this also refreshes `lastSeenAt`.
  - no `OFFLINE` write on disconnect. App Hosting ends every stream after 5 minutes, so a disconnect is usually followed by a reconnect seconds later. Writing `OFFLINE` would make every agent flicker offline. A delayed write isn't reliable either, because the instance loses CPU once no request is open.
- **Offline rule:** an agent whose `lastSeenAt` is more than 10 minutes old counts as offline. This also covers server crashes.
- **Desktop:** drops its `/devices/heartbeat` loop. Diagnostics show the agent's stream state instead.
- **Routing:** `routePrintJob` in [`print-job.service.ts`](../../apps/server/src/modules/printing/print-job.service.ts) can then skip printers whose agent is offline, so jobs stop queuing for a PC that's switched off.
- **Older agents** keep polling `/jobs`, which 7.3 has already made cheap.

---

## 10. Customer order tracking

- **Server:**
  - Don't read `statusHistory` for guest order requests (`getGuestOrder` → `getShopOrderById`).
  - Answer active orders from the shop hub.
  - Cache the guest session for 60 seconds.
- **Web app** ([`use-order-tracking.ts`](../../apps/printUserWebapp/src/hooks/use-order-tracking.ts), [`tracking-constants.ts`](../../apps/printUserWebapp/src/data/tracking-constants.ts)): slow polling from 6 s to 30 s while nothing changes, and pause it while the tab is hidden.

**Effect:** from 30–70 reads per minute per waiting customer to about one read per minute.

---

## 11. Expected results

1,000 idle desktops, UI and agent open all day, with the same price assumptions as section 5. Phase 1 is split into 1a (no hub) and 1b (hub); see section 12.

| | Today | After 1a | After 1b | After Phase 2 | After Phase 3 |
| --- | --- | --- | --- | --- | --- |
| Requests/s | 67 | 67 | 67 | 25 | ~3 |
| Time per request | 0.4–1.4 s | ~5–30 ms | ~5–30 ms | ~5–30 ms | mostly push |
| Firestore reads/day | 17.3 M | ~3.7 M | ~0.9 M | ~0.9 M | ~0.3 M |
| Firestore writes/day | 2.9 M | ~0.3 M | ~0.3 M | ~0.3 M | ~0.3 M |
| Calls to Google for tokens/day | 2.9 M | 0 | 0 | ~24 k (hourly refresh) | ~24 k |
| Idle Firestore cost/month | $235–470 | ~$42–83 | ~$16–32 | ~$16–32 | ~$10–20 |
| Reads per order-stream reconnect | whole history | whole history | 0, or ~100–300 for a new hub | same as 1b | same as 1b |

Request counts stay at 67/s through Phase 1 because installed desktops keep their current timers. What changes is how cheap each request is.

How the per-desktop figures behind the table are reached:

- **After 1a:**
  - user-cache misses, one every 5 minutes × 2 reads = 576 reads/day;
  - agent-credential cache misses = 288 reads/day;
  - one query per job poll = 2,880 reads/day;
  - presence writes every 5 minutes = 288 writes/day.
- **After 1b:** the same, except job polls are answered from the hub, so the 2,880 poll reads become 0.
- **After 1b,** the presence write is most of the remaining cost.

---

## 12. Rollout and effort

| Step | Contents | Desktop update needed | Behaviour change | Rough effort |
| --- | --- | --- | --- | --- |
| 1a | 7.1, 7.2, 7.3 without the hub, 7.5; tracking server fixes from section 10 (no `statusHistory`, session cache) | No | Staff deactivation can take up to 5 minutes | 3–4 days |
| 1b | 7.4 shop hub; job list and tracking served from the hub | No | Installed desktops' stream snapshot holds only the live window (decision 2) | 3–4 days |
| 2 | 8.1–8.4; web app tracking poll from section 10 | Yes, one installer | None for users | 6–7 days |
| 3 | 9.1–9.2 | Yes | Offline PCs no longer receive jobs | 5–6 days |

Effort is a rough estimate for one engineer who knows this code.

- **Adoption:** track it with the `appVersion` and `agentVersion` each device already sends when it registers. Once old versions are gone, the server can reject them with a clear "please update" response.
- **Polling endpoints stay** for as long as older agents exist.
- **Web app changes** need no install, so they can ship at any time.

---

## 13. Testing

- **Unit tests:**
  - **Hub:** snapshot, replay, grace period, midnight re-subscribe, and fallback when unhealthy.
  - **Server caches:** user cache, credential cache, and the heartbeat write throttle.
  - **Desktop:** token refresh with one shared request (Vitest).
  - **Agent:** backoff and report handling (C# with a fake HTTP handler).
- **Load test:** simulate 1,000 desktops (heartbeat, poll and order stream) against a staging Firebase project with the per-request read/write counters on.
  - Target: p95 under 100 ms.
  - Target: reads and writes per desktop matching section 11.
- **Manual:**
  - Leave a desktop open for more than an hour and confirm there are no 401s.
  - Cut the network for a minute and confirm the stream resumes without a full snapshot.
  - Switch a PC off and confirm jobs route to another printer (Phase 3).

---

## 14. Open decisions

1. **Hosting:** *decided 15 Oct 2026:* Firebase App Hosting (serverless, on Cloud Run). The hub and push still work with the rules in 7.4: 5-minute streams, short hub grace period, no `OFFLINE` write on disconnect. Run settings are in [`apps/server/apphosting.yaml`](../../apps/server/apphosting.yaml).
2. **Installed desktops:** are any already in shops? If so, should step 1b keep sending them full history, keeping that cost until they update, or accept the shorter live window?
3. **Delays:** are these acceptable?
   - Up to 5 minutes for staff deactivation.
   - Up to 10 minutes to detect an offline PC. Phase 3 doesn't make this immediate on App Hosting, because a disconnect can't be told apart from the routine 5-minute stream close (9.2).
4. **Filename search in old orders:** add `searchKeys` with a backfill, or search filenames only in recent orders?

---

## 15. Not verified yet

- **Spike cause:** what causes the 17–32 s spikes. Finding out needs timestamps and the event-loop metric from 7.5.
- **Firestore region:** the ~200 ms per call was measured from a development machine.
- **Index deployment:** whether the collection-group indexes for print jobs are deployed (4.4).
- **Token-expiry storm (4.2):** comes from reading the code and has not been reproduced.
- **Prices and document sizes** are assumptions. Check current Firestore pricing for your region.
- **SSE on App Hosting:** whether events arrive as they're written or are buffered until the 5-minute close. Check on a deployed backend before relying on push ([`deployment.md`](../../apps/server/docs/deployment.md#not-verified-yet)).
- **Current desktop reconnect:** today's desktop treats the 5-minute close like a failure. It waits about 1 s and briefly shows "reconnecting". It recovers, but 9.1's rule (reconnect at once on a clean close) should apply to the desktop's order stream too.

---

## Appendix A. Contract changes

| Kind | Change | Phase |
| --- | --- | --- |
| Response | `POST /api/v1/devices/heartbeat` returns `heartbeatIntervalSeconds: 120` | 1a |
| Response | `GET /api/v1/shops/{shopId}/agents/{agentId}/jobs` adds `pollAfterSeconds` | 1a |
| Stream | Order-stream events carry `id:`; the server honours `Last-Event-ID`; the snapshot is the live window | 1b |
| Endpoint | `GET /api/v1/shops/{shopId}/orders` gains paging (`status`, `date`, `cursor`, `limit`) | 2 |
| Endpoint | `GET /api/v1/shops/{shopId}/orders/search?q=` | 2 |
| Field | `orders.searchKeys: string[]`, written on order creation, plus a backfill | 2 |
| Endpoint | `GET /api/v1/shops/{shopId}/agents/{agentId}/stream` (SSE) | 3 |
| Meaning | Agent is online when `status` is ONLINE and `lastSeenAt` is under 10 minutes old | 1a helper; written by the stream in 3 |

## Appendix B. Firestore indexes to add

Add these to [`packages/firebase/docs/firestore.indexes.json`](../../packages/firebase/docs/firestore.indexes.json) and deploy them.

| Collection | Scope | Fields | Used by |
| --- | --- | --- | --- |
| `orders` | Collection | `status` ASC, `updatedAt` ASC | Hub listener 2 |
| `orders` | Collection | `status` ASC, `createdAt` DESC | History endpoint with a status filter |
| `orders` | Collection | `searchKeys` ARRAY_CONTAINS, `createdAt` DESC | Search endpoint |
| `printJobs` | Collection group | `shopId` ASC, `status` ASC | Hub listener 3 |
| `printJobs` | Collection group | `shopId` ASC, `agentId` ASC, `status` ASC, `createdAt` ASC | Job-list query when no hub is available |

## Appendix C. Settings

| Setting | Value | Owner |
| --- | --- | --- |
| User cache TTL | 5 minutes | Server |
| Agent credential cache TTL | 5 minutes | Server |
| Presence write interval | 5 minutes | Server |
| Agent counts as offline after | 10 minutes | Server |
| Hub grace period | 60 s: longer than a reconnect, short because App Hosting gives no CPU between requests | Server |
| Hub replay buffer | 500 events | Server |
| Heartbeat interval | 120 s, sent by the server | Server → desktop |
| Idle poll | 60 s (`pollAfterSeconds`) | Server → agent |
| Busy poll | 3 s | Agent |
| Safety poll (Phase 3) | 300 s | Server → agent |
| Stream ping | 15–20 s | Server |
| Reconnect backoff cap | 30–60 s with jitter, after failed connects only. A clean end of stream (every 5 minutes on App Hosting) reconnects at once. | Desktop, agent |
| Stream lifetime | 5 minutes, set by App Hosting | Platform |
| Rate limit | 30 requests/min per device or agent | Server |

## Related docs

- [`PRINT_SHOP_DESKTOP.md`](./PRINT_SHOP_DESKTOP.md): desktop architecture.
- [`CtrlP_Print_Shop_Desktop_MVP_Progress.md`](../developer-requirement/desktop-app/CtrlP_Print_Shop_Desktop_MVP_Progress.md): PRD progress.
- [`Order_to_Print_Execution_Runbook.md`](../developer-requirement/desktop-app/Order_to_Print_Execution_Runbook.md): order-to-print flow.
- [`apps/server/docs/print-user.md`](../../apps/server/docs/print-user.md): guest upload and checkout API.
