# Desktop traffic and server load: serverless plan

> **Status:** **Accepted**, version 2.2, 15 Oct 2026. The doorbell spike passed (7.1): the stream delivered every ring, with p95 latency of 77 ms, an idle cost of about 6.4 KB per PC-hour, and clean recovery at token expiry. Field checks on real shop networks are still running (implementation plan 3.3). Nothing in this document is implemented yet.
> **History:** version 2.1 was revised after the minimized-window spike: a minimized WebView2 window doesn't deliver Firestore listener updates reliably, so nothing time-critical may run in the desktop's web view. Version 1 (server hub and SSE) is in git history (`ccadc8b`).
> **Hosting:** Firebase App Hosting (serverless, on Cloud Run). See [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md).
> **Implementation plan:** [`TRAFFIC_SCALING_V2_IMPLEMENTATION.md`](./TRAFFIC_SCALING_V2_IMPLEMENTATION.md) lists the file-level changes, contracts, work breakdown and tests.
> **Scope:** `apps/server`, `apps/print-shop` (desktop UI), `apps/print-agent` (C# agent), and the customer web app `apps/printUserWebapp`.
> **Problem:** every open shop desktop sends requests on timers, and each request does slow, billable work. Cost grows with every installed desktop, even when no orders arrive.

---

## 1. Summary

**The idea:** each shop PC's print agent keeps one tiny, always-open connection to Firebase Realtime Database: a **doorbell**.

- **The server rings it** when something happens for the shop. Ringing means writing a timestamp to `/doorbell/{shopId}`.
- **The agent wakes on the ring.** In one request it takes everything it should do: it accepts paid orders and claims its print jobs.
- **The desktop window only displays.** When the doorbell rings and the window is visible, it fetches what changed.
- **No timers through our server.** Nothing runs on a timer through our server, and nothing time-critical runs in the web view.

- **Jobs arrive almost instantly, minimized or not.** The agent is a normal Windows process, so it isn't throttled like a minimized web view. Expected time from a customer paying to the agent starting the download: about 1–1.5 seconds with a warm server (to be measured).
- **The connection is officially supported and has no SDK.** The doorbell uses Realtime Database's documented REST streaming (Server-Sent Events). It signs in with the same Firebase ID token the client SDKs use, and security rules apply. The agent reads it with a plain `HttpClient`.
- **An idle desktop costs nothing on Firestore or our server.** An idle doorbell costs only a few bytes of keep-alive traffic. Realtime Database bills by bandwidth, with 10 GB/month free.
- **The desktop needs no Firebase SDK.** Its window gets its login token from the agent and its data from our API. Firestore stays server-only for shop data.
- **The server is stateless:** no hub, no SSE, nothing to rebuild. It can scale to zero.
- **Online status is relaxed, as agreed.** A paid order is accepted by a running agent, so "accepted" proves a PC is on.
- **Cost:** at 1,000 shops open all day and 1,000 orders a day, usage stays about at the free tier. Any overage is well under $1/month (section 10).

| 1,000 shops open 12 h/day, 1,000 orders/day | Today | Plan v1 after Phase 3 | **This plan** |
| --- | --- | --- | --- |
| Our server requests/day | ~2.9 M | ~260 k | **~45 k** |
| Firestore reads/day | ~8.6 M | ~0.3 M | **~55–60 k** |
| Firestore writes/day | ~1.4 M | ~0.3 M | **~30 k** |
| Realtime Database download/month | — | — | **~2.5 GB measured idle cost, plus rings (10 GB free)** |
| Instances kept running by open streams | 1+ all day | 1–13 all day | **none** |
| Cost while no orders arrive | ~$120–235/month | ~$85+/month | **~$0** |

---

## 2. Requirements and budget

### 2.1 Requirements

| Requirement | Target |
| --- | --- |
| A queued job reaches the shop's agent | Almost instantly: a few seconds at most, **including while the desktop is minimized** |
| Shop/agent online status | Can lag by 5–10 minutes. Not a priority. |
| Cost | As close to the free tier as possible at about 1,000 shops/customers |
| Existing users | None. Contracts and data can change freely. |

### 2.2 Free tier

Usage is pooled per billing account. App Hosting requires the Blaze plan.

| Resource | Free amount | Per day | Price above it |
| --- | --- | --- | --- |
| Firestore document reads | 50,000/day | 50,000 | ~$0.03–0.06 per 100 k (by region) |
| Firestore document writes | 20,000/day | 20,000 | ~$0.09–0.18 per 100 k |
| Firestore deletes | 20,000/day | 20,000 | ~$0.01–0.02 per 100 k |
| Cloud Run requests (both backends together) | 2 M/month | ~66,000 | $0.40 per million |
| Cloud Run CPU while handling requests | 180,000 vCPU-s/month | ~6,000 vCPU-s | $0.000024 per vCPU-s |
| Cloud Run memory while handling requests | 360,000 GiB-s/month | ~12,000 GiB-s | $0.0000025 per GiB-s |
| Realtime Database downloads | 10 GB/month | ~330 MB | $1 per GB |
| Realtime Database storage | 1 GB | — | $5 per GB-month |
| Realtime Database simultaneous connections | 200,000 per database | — | — |

Sources are in Appendix E. Check prices for your databases' regions.

### 2.3 How the realtime parts are billed

**Realtime Database (the doorbell):**

- **Billed by downloaded bytes and storage,** not by operation or connection.
- **Each new connection costs about 3.5 KB** of TLS handshake, and each message costs a few tens of bytes of overhead.
- **An idle stream** receives only small `keep-alive` events.
- **The value stays tiny:** two timestamps and a short "last event" record.

**Firestore listeners** (used only by the customer tracking page):

- One read when a document enters or changes in the results; nothing while nothing changes.
- At least one read per query.
- A full re-read after more than 30 minutes offline.
- Security rules that read documents cost reads, so the rules use only token fields.

---

## 3. What happens today

Findings from reading the code.

### 3.1 Requests on timers

| Request | Sent by | How often | Cost per request |
| --- | --- | --- | --- |
| `POST /api/v1/devices/heartbeat` | Desktop UI ([`App.tsx`](../../apps/print-shop/src/App.tsx), `setInterval`) | Every 30 s, overlapping when slow | 1 call to Google to check the token, ≥4 reads, ≥1 write |
| `GET /api/v1/shops/{shopId}/agents/{agentId}/jobs` | C# agent ([`AgentCloudSynchronizer.cs`](../../apps/print-agent/src/Ctrlp.PrintAgent.Core/Cloud/AgentCloudSynchronizer.cs)) | 3 s after work, backing off to 30 s when idle | 2 reads |
| `GET /api/v1/shops/{shopId}/orders/stream` (SSE) | Desktop UI ([`cloud.ts`](../../apps/print-shop/src/lib/cloud.ts)) | Always open; App Hosting cuts it every 5 minutes, then it reconnects | Each connection re-reads **every** order and print job the shop has ever had |
| `GET /api/v1/shops/{shopId}/orders` | Desktop UI | Each time the stream starts | The full order history |
| `GET /api/v1/public/session/orders/{orderId}` | Customer tracking page | Every 6 s until the order is completed | Session, order, and its whole `statusHistory` |

### 3.2 Other findings

- **Auth is slow on every desktop request.** It calls Google (`accounts:lookup`) and then makes 2 reads. `verifyIdToken` isn't used anywhere.
- **Expired tokens cause a request storm.** The desktop never refreshes its 1-hour ID token after startup. After an hour, every heartbeat fails and the stream retries every ≤10 s.
- **Jobs are queued only after accept.** `queueIncomingOrder` runs once an order is `SHOP_ACCEPTED`: by a manual accept (always needed for CASH), or by the server auto-accepting a paid ONLINE order.
- **Paid orders are auto-accepted into a dead queue.** The server auto-accepts a paid order even when no desktop is running, and the job then sits QUEUED.
- **Printers are never marked offline** when the app closes.
- **Agent online status has no reader.** Its `status`/`lastSeenAt` are written on every heartbeat and read only by the sweep that marks agents stale.
- **About 5–7 agent requests per job:** claim, document ticket, a status `PATCH` per local event, a shred confirmation, and re-reports.
- **The agent outlives the window.** It's a detached, per-user, single-instance sidecar. Tauri never kills it, and `--parent-pid` isn't passed, so after the app closes, and even after sign-out, it keeps polling and printing with its agent key. It talks to the UI over the named pipe `\\.\pipe\ctrlp-print-agent`. This plan makes it exit with the app (decision 10).
- **The mock payment route has no environment check.** In production any guest can mark their own ONLINE order PAID (implementation plan P1-00).
- **Sign-out revokes refresh tokens,** which signs the same login out on every PC.
- **There's no lease expiry.** A job claimed by an agent that dies before queuing it stays DISPATCHING forever.

### 3.3 Cost of today's code

Per desktop that's open, per hour: about **240 requests, 720 reads and 120 writes**, plus a full history re-read at least every 5 minutes. Three desktops left open around the clock use up the whole free read quota.

---

## 4. Why the earlier designs don't fit

### 4.1 Version 1: server hub and SSE

- **Open streams keep instances billed all day.** Cloud Run bills an instance with an open streaming request at the full rate. That's about $63/month per busy instance, and 1,000 desktop streams need several.
- **Short-lived instances lose their memory,** so hubs and caches keep being rebuilt.
- **Streams are cut every 5 minutes** by App Hosting.
- **Timers still dominated:** about 0.3 M reads and writes a day while idle.

### 4.2 Version 2: Firestore listeners in the desktop window

The spike showed that a **minimized WebView2 window doesn't deliver Firestore listener updates reliably.** Tauri's background-throttling switch covers only WebKit on macOS/Linux. Shops run the app minimized, so anything in the web view can stall while minimized, including:

- the jobs listener;
- auto-accept;
- token refresh.

### 4.3 The written fallback, rejected: Firestore in the agent

The fallback was the agent listening to Firestore with `Google.Cloud.Firestore`, using the user's ID token. It was rejected because:

- **The login method is undocumented.** That library is built for service accounts; using an end-user Firebase token as its credential isn't documented, so it could break without notice.
- **The dependency is large** (gRPC and the Firestore client), and the agent's rules forbid a Firebase SDK.
- **The agent would still need its own token refresh** and stream restarts.

Realtime Database REST streaming does the same job with documented behaviour, plain HTTPS, and no SDK.

---

## 5. Target design

```text
 Customer web app ─┐                         Firestore (shop data; server-only for shops)
 Desktop UI ───────┼──▶ API on Cloud Run ──▶   └─ orderTracking/{orderId} ──▶ customer tracking listener
 Print agent ──────┘    (stateless)
                             │ after each write: "ring" (one HTTPS PATCH, server timestamp)
                             ▼
                  Realtime Database  /doorbell/{shopId} = { boardAt, workAt, last }
                             │ REST stream (SSE, ID token), one per shop PC
                             ▼
                  Print agent (always on, not throttled)
                   ├─ workAt changed  ──▶ POST .../agents/{agentId}/sync ──▶ claimed jobs + download URLs
                   ├─ print, then POST .../jobs/report
                   ├─ boardAt changed ──▶ pipe "board.changed" ──▶ Desktop UI fetches GET .../board?since=
                   └─ new order       ──▶ native Windows notification (from the Rust side, not the web view)
```

### 5.1 Principles

1. **Idle means zero:** no timers through our server, no Firestore reads.
2. **Time-critical work runs only in the agent.** The web view may be frozen.
3. **The doorbell carries no data,** just "something changed, and when". All data comes from our API, which checks permissions.
4. **Level-triggered:** the agent's `sync` looks at the current state (paid orders waiting, queued jobs), never at individual events. A missed or merged ring can't lose work.
5. **One owner per job:** the agent owns the PC's Firebase login and keeps the token fresh. The window asks the agent for a token.

### 5.2 How a job gets to the agent

Example: an ONLINE order with 2 files, API instance warm. Times are estimates to measure in the spike.

| Time | What happens | Who |
| --- | --- | --- |
| 0 | The customer pays. The server marks the order paid, then rings the doorbell (`workAt`, `boardAt`). | API |
| ~0.2–0.4 s | The agent's stream receives the change. `workAt` is newer than the last one handled. | Realtime Database → agent |
| ~0.3–0.5 s | The agent calls `sync`. In one request the server auto-accepts the paid order, queues its jobs (preferring this PC's printers), claims them for this agent, and returns download URLs. | Agent → API |
| ~1–1.5 s | Download from Railway starts; then print. | Agent |
| at the end | One final report per job. When every document is done, the order becomes `READY`. | Agent → API |

- **CASH orders:** the server rings with a "new order" event. The agent shows a native Windows notification. The operator opens the app and presses Accept; the server queues the jobs and rings; the agent syncs and prints.
- **Cold start:** add about 2–5 s if the API instance is cold. The customer's own requests usually warm it first.

### 5.3 Realtime channels

| Channel | Who | Cost |
| --- | --- | --- |
| Doorbell `/doorbell/{shopId}` (Realtime Database REST stream) | Each shop PC's agent | Keep-alives, a 3.5 KB handshake per reconnect (about hourly, when the token is renewed), a few hundred bytes per ring. No Firestore reads. |
| `board.changed` (named pipe) | Agent → desktop UI | Local only |
| `GET .../board?since=` (our API) | Desktop UI, only when visible, after a ring or on focus | 1 request; reads = at least 2 plus the changed documents |
| `orderTracking/{orderId}` (Firestore listener) | Customer tracking page (a foreground browser tab) | 1 read to start, then 1 per visible change |

### 5.4 Who signs in how

| Client | Signs in with | Server checks | Rules use |
| --- | --- | --- | --- |
| Print agent | Owns the PC's Firebase refresh token, in Windows Credential Manager as today. It gets fresh ID tokens directly from Google's Secure Token API (no request to our server), and uses them for our API (`Bearer`) and the doorbell (`auth=`). | `verifyIdToken` locally; `shopId`, `shopUserId` and `role` come from custom claims. 0 reads. | Realtime Database: `auth.token.shopId == $shopId` |
| Desktop UI | Asks the agent for the current ID token over the pipe (`cloud.getIdToken`) for each API call. No token handling of its own. | Same | — |
| Customer | A custom token for `uid = printUserId`, returned when the guest session starts. Used only on the tracking page. | Signed guest cookie | Firestore `orderTracking`: `resource.data.printUserId == request.auth.uid` |

- **The agent's API key goes away.** That saves a credential read per agent request.
- **One token owner per PC.** This also removes today's expired-token storm.

### 5.5 Online status, kept cheap

| Need | How it's met | Cost |
| --- | --- | --- |
| Don't auto-accept a paid order no PC will print | The **agent's `sync`** auto-accepts paid orders. With no PC running, nobody syncs and the order waits as `SUBMITTED` and paid. | 0 extra |
| Don't route jobs to a PC that's off | Accept, whether from `sync` or the Accept button, routes to the caller's printers first. Printers are marked OFFLINE on sign-out, and by the agent as it exits with the app (best effort). A job stuck on a dead PC can be retried to another printer after 15 minutes. | 1 request per exit |
| Tell the customer the shop hasn't seen the order | The tracking page shows "The shop hasn't confirmed your order yet" after 10 minutes in `SUBMITTED`. | 0 |
| "Last active" in admin views | `lastActiveAt` on the device, written at most every 10 minutes on requests the PC already makes. | ≤6 writes per active hour, 0 when idle |

A live "online now" indicator isn't needed. If it becomes one, see 9.1: it costs almost nothing with Realtime Database.

### 5.6 What's removed

| Removed | Replaced by |
| --- | --- |
| Heartbeat route and the desktop's 30 s loop | Nothing (5.5) |
| Agent poll loop, the per-job claim/ticket/PATCH/shred routes, and the agent API key | Doorbell, `sync`, `report`, and the user's ID token |
| SSE order stream, `subscribeShopOrders`, and the full `GET .../orders` at startup | `GET .../board` (initial and changes) after a ring or on focus |
| Server-side auto-accept on payment | Agent `sync` |
| Desktop token handling (the storm in 3.2) | The agent owns refresh |
| Tracking poll every 6 s | Firestore listener on `orderTracking` |
| Version 1's hub, agent stream and presence-from-stream | Not built |

---

## 6. Phase 1: foundation (server and Firebase config)

### 6.1 Verify tokens locally, trust claims

- Replace `lookupIdToken` with `getFirebaseAuth().verifyIdToken(token)`, which runs locally against cached Google keys.
- Custom claims `{ shopId, shopUserId, role }` are already set at registration. Make that step required: today a failure is only logged.
- Read principal fields from the token. No `authLookups` or user reads on the request path.
- **Deactivating staff:** disable the Firebase user and revoke refresh tokens. The agent's next token refresh fails, and existing ID tokens expire within an hour. Sensitive routes check revocation immediately.
- **Ordinary sign-out doesn't revoke** (decision 11), because one login often runs on several PCs.

### 6.2 Doorbell

- **Create the Realtime Database instance** in the region closest to shops: `asia-southeast1` for India. It holds only `/doorbell/{shopId}`.
- **Ring helper** `ringShop(shopId, { work, event })`:
  - One HTTPS `PATCH` to `/doorbell/{shopId}.json` with a service-account OAuth token (scopes `firebase.database` and `userinfo.email`, cached until expiry).
  - The body is `{ boardAt: {".sv":"timestamp"}, workAt?: {".sv":"timestamp"}, last: { type, orderId, orderNumber } }`.
  - It runs after the Firestore transaction commits and **is awaited before responding**, because Cloud Run takes CPU away once the response is sent.
  - On failure it retries once, then logs. Failures never fail the request.
- **When to ring:**

| Event | `workAt` (agents sync) | `boardAt` (UI refresh) | `last.type` |
| --- | --- | --- | --- |
| Guest or shop order created | — | yes | `order_submitted` (agents show a notification) |
| Online payment confirmed | yes | yes | `order_paid` (notification) |
| Manual accept, dispatch or retry queues jobs | yes, unless every job went to the caller's own agent within `sync` | yes | `jobs_queued` |
| Reject, cancel, ready, complete, cash collected, job report | — | yes | `order_updated` |

### 6.3 Rules, indexes and project config

- `firebase.json` with Firestore rules and indexes, Realtime Database rules, and emulators.
- **Firestore rules:** clients can read only `orderTracking/{id}` where `printUserId == auth.uid`. Everything else is server-only.
- **Realtime Database rules:** read `/doorbell/$shopId` when `auth.token.shopId == $shopId`. No client writes anywhere.
- Rules tests on both emulators.

### 6.4 Data changes

- **Status times:** extend the order's existing `lifecycle` map (`printingAt`, `rejectedAt`, `cancelledAt`, `paidAt`) and drop `statusHistory`.
- **`completedDocumentIds`:** decides READY without reading sibling jobs.
- **`updatedAt` uses the server timestamp** on every order and job write, so `board?since=` can find changes.
- **Fewer job states:** QUEUED → DISPATCHING → COMPLETED / FAILED / CANCELLED (no PRINTING).
- **Idempotency:** leases make claim and report idempotent; status makes transitions idempotent. Keep keys for order submission and dispatch.
- **`searchKeys`** on orders, for the desktop's search.
- **`orderTracking/{orderId}`:** a customer-safe copy written in the same transaction as guest order changes (about 6 writes per order). Rules can't hide fields, so guests never read the order itself.

### 6.5 Visibility and guard rails

- Per-request read/write counters in the logs.
- Budget alerts on Firestore, Cloud Run and Realtime Database bandwidth.
- A per-instance rate limit to stop a client stuck in a loop.

---

## 7. Phase 2: agent-driven delivery

### 7.1 Doorbell spike: passed (15 Oct 2026)

A C# console app streamed `/doorbell/spike.json` with an ID token while a script rang it. The run lasted 72 minutes on the dev PC, against project `meetctrlp`. Full results are in implementation plan 3.2 and `spikes/doorbell/README.md`.

| Measured | Result |
| --- | --- |
| Commit → event latency | p50 54 ms, p95 77 ms (target under 500 ms) |
| Missed values | None. Everything that reached the database arrived. |
| Keep-alive interval | 30 s, so the watchdog is 65 s |
| Idle bandwidth | About 6.4 KB per connection-hour (budget 25 KB) |
| Token expiry | `auth_revoked` at exactly 60 minutes; back in 1.3 s with the latest value |
| Rules | A shop reads only its own doorbell; nobody writes |

**What it changed:**

- The polling fallback now counts only *broken* streams, 3 in a row. The draft rule ("5 failed connects in 10 minutes") put a PC on polling for 30 minutes after a 33-second Wi-Fi drop.
- A ring that times out may still have landed, so it's logged as "unknown".

**Still open:** real shop networks (especially antivirus HTTPS scanning), a 40-minute cut, sleep/resume, and the console's bandwidth figure. If a network buffers or blocks the stream, use the fallback in 7.2: polling the tiny doorbell value.

### 7.2 Agent

- **Token owner:** refreshes the ID token with Google's Secure Token API using the refresh token already in Credential Manager. It refreshes at 55 minutes, or on `auth_revoked` or a 401.
- **Doorbell stream:**
  - one `HttpClient` SSE stream with an automatic reconnect;
  - a watchdog that reconnects if nothing arrives within 65 s (2× the measured 30 s keep-alive, plus slack);
  - switches to polling only after 3 broken streams in a row. Being offline doesn't count;
  - remembers the last handled `workAt` and `boardAt`.
- **On `workAt` change** (including the first value after any reconnect): call `sync`, and repeat while `more` is true.
- **On `boardAt` change:** send `board.changed` to the UI.
- **On `last.type` = `order_submitted` or `order_paid`:** send `orders.attention`. The Rust side shows a native notification and flashes the taskbar, independent of the web view.
- **Print and report:** unchanged locally. One final report per job goes through a SQLite outbox, with retries only on network errors, 429 and 5xx. 404 and 409 are final.
- **Never print twice:** a job already known locally with the same lease is skipped, whatever its state.
- **Lifetime:** the agent exits with the desktop app and marks the PC's printers OFFLINE on the way out (decision 10).
- **Fallback if the stream can't stay up** (from the spike): a plain `GET /doorbell/{shopId}.json` every 60 s. It costs Realtime Database bandwidth only, no Firestore reads or server requests.

### 7.3 Server endpoints

- **`POST .../agents/{agentId}/sync`:**
  1. Auto-accepts up to 10 paid `SUBMITTED` orders (if the shop's `autoAcceptPaidOnline` is on), routing to this agent's printers first.
  2. Claims up to 10 QUEUED jobs for this agent.
  3. Re-delivers this agent's jobs that have been DISPATCHING for more than 15 minutes, with the same lease and a fresh URL. This recovers from an agent that died between the claim and queuing the job locally.
  4. Returns `{ accepted, claimed (with 60-minute download URLs), more }`.
- **`POST .../agents/{agentId}/jobs/report`:** batch final reports. Checks the lease, updates `completedDocumentIds`, sets READY after the last document, deletes the storage object on COMPLETED (the report succeeds only once the object is deleted), and rings `boardAt`.
- **`GET .../board?since=`:**
  - without `since`: active orders and unfinished jobs;
  - with `since`: orders and jobs whose `updatedAt` is later than `since − 5 s`;
  - returns a new cursor.
- **`GET .../orders?status=&from=&to=&cursor=`** and **`GET .../orders/search?q=`:** paged history and search, replacing in-memory filtering of the full history.
- **Remove:**
  - heartbeat;
  - the agent jobs list and the per-job claim, PATCH, document and shred routes;
  - SSE stream and full order list;
  - server-side auto-accept on payment;
  - agent credential checks.

### 7.4 Desktop UI

- **API calls get their bearer token from the agent** (`cloud.getIdToken` over the pipe). Remove the heartbeat effect, the SSE client and the full order list.
- **Board:**
  - fetch `GET .../board` at start;
  - then `?since=` on `board.changed` (debounced 300 ms) **only while the window is visible**, and once on focus or restore.
- **History and search** use the new paged endpoints.
- **No Firebase SDK in the desktop.**
- **Sign-out:** `cloud.clear` to the agent (stops the stream, forgets the token), mark this PC's printers OFFLINE, and clear the stored refresh token.

### 7.5 Rust bridge

- **One-way notifications:** add a `notify` for UI → agent (`cloud.configure`, `cloud.session`, `cloud.clear`, `sync.request`).
- **Native notifications:** handle `orders.attention` in Rust with a Windows notification and a taskbar flash, then forward it to the UI.

---

## 8. Phase 3: customer side and cost trims

### 8.1 Tracking with a listener

- **The tracking page only:** lazy-load the Firebase SDK, sign in with the session's `firebaseToken`, and listen to `orderTracking/{orderId}`. Customers are in a foreground browser tab, so web-view throttling doesn't apply.
- **When to detach:** on a terminal status.
- **Fallback:** if the listener fails, make one `GET` and show a Refresh button.
- **"Shop hasn't confirmed":** shown after 10 minutes in `SUBMITTED`.

### 8.2 Guest API trims

- Signed session cookie (no session read just to authenticate).
- Read the session once per request.
- Shop config cached 60 s per instance.
- One quote.
- Keep the cart in memory between pages.

### 8.3 Hosting settings

- `minInstances: 0` once the SSE stream is gone. That saves about $13/month idle.
- Update [`deployment.md`](../../apps/server/docs/deployment.md).

### 8.4 Web app proxy: keep for now

At 1,000 orders/day requests stay within the free tier. Above about 2,000 orders/day, consider serving the API at `api.<domain>` to halve customer-side requests.

---

## 9. Optional, only if needed

### 9.1 Live online status

The agent writes `/presence/{shopId}/{agentId} = { at: server timestamp }` every 5 minutes over the same REST API. That costs Realtime Database bandwidth only, about 1 KB per write including TLS. The server reads it when it needs to know which PCs are on.

This gives status within 5 minutes for 1,000 PCs at roughly 4 GB/month of bandwidth, with no Firestore operations.

### 9.2 Agent as a Windows service

The agent already owns its login and doorbell. As a service it could print while the window is closed. It would need its own credential lifecycle, because the refresh token is per user today.

### 9.3 Firestore listener in the UI while visible

To save the board's reads on very busy shops, the UI could use a Firestore listener while the window is visible and fall back to `board?since=` otherwise. Not needed at the expected volume.

### 9.4 Moving print jobs

Storing jobs at `shops/{shopId}/printJobs/{jobId}` would remove a collection-group index. Not required.

---

## 10. Cost model

### 10.1 Per order

2 files, ONLINE payment, one PC with the window visible half the time, the customer watching tracking, after Phases 1–3. These are estimates; the counters in 6.5 will give real numbers.

| Step | Our server requests (with proxy) | Reads | Writes |
| --- | --- | --- | --- |
| Customer: shop page and session | 3–4 | ~3 | 1 |
| Upload 2 files | 8 | ~6 | 4 |
| Customize, review, quote | 5–6 | ~5 | 1 |
| Place the order and pay | 4 | ~6 | ~6 |
| Agent `sync`: auto-accept, queue and claim 2 jobs | 1 | ~10 | ~7 |
| Agent: 2 final reports | 1–2 | ~4 | ~5 |
| Shop hands over the prints | 1 | ~1 | ~1 |
| Customer tracking copy | 0 | 0 | ~6 |
| Desktop board refreshes (about 4 while visible) | ~4 | ~10 | 0 |
| Customer tracking listener | 0 | ~7 | 0 |
| Web app page loads | ~5 | 0 | 0 |
| **Total** | **~33–38** | **~52–55** | **~30** |

Doorbell rings: about 8 per order, a few hundred bytes each to each of the shop's PCs. There's no Firestore or server cost on the receiving side.

### 10.2 Per day

App start ≈ 3 requests (me, register, board) and the board's first reads (about 5–10).

| Usage | Requests/day | Reads/day | Writes/day | Realtime Database | Above the free tier, per month |
| --- | --- | --- | --- | --- | --- |
| 1,000 PCs open 12 h, no orders | ~3 k (app starts) | ~8 k | ~1 k | ~2.3 GB/month measured (6.4 KB per PC-hour for keep-alives and hourly reconnects); a PC on the polling fallback uses an estimated 30–60 KB/h | $0 |
| + 1,000 orders/day | ~40–45 k (free: 66 k) | ~55–60 k (free: 50 k) | ~30 k (free: 20 k) | about the same | well under $1 |
| + 10,000 orders/day | ~360 k | ~550 k | ~300 k | about the same | about $45–60, plus about $1,200 if Identity Platform is on (guest sign-ins above 50 k MAU; see 15) |

**What drives the cost:**

- **Orders, not installed PCs.** An idle PC costs only doorbell keep-alives.
- **Writes to active orders.** Every one rings the board, and each visible desktop then fetches the change.
- **Board fetches while visible.** Debouncing and "only when visible" keep them low.

---

## 11. Risks and how they're handled

| Risk | Handling |
| --- | --- |
| A shop's network buffers or blocks the SSE stream | Spike passed on broadband (7.1); shop networks checked before the agent ships (implementation plan 3.3); 65 s watchdog; fallback 60 s poll of the doorbell value after 3 broken streams (bandwidth only) |
| A ring fails after a write | One retry, then a `ring_failed` alert. A ring that never landed leaves `workAt` unchanged, so an agent reconnect doesn't catch up. What does: the shop's next work ring, an agent restart, the desktop's stale-work nudge on the next board fetch, or the operator's "Sync now". All work, because `sync` looks at state, not events. Decision 9 covers an optional safety sync. A ring that times out may still have landed (spike), so timeouts are logged separately as `ring_unknown`. |
| Realtime Database outage | Jobs wait. The operator's Accept or "Sync now" still works through the API. |
| Merged rings drop a notification | Notifications are a convenience. The board, fetched on focus, shows every order. |
| The agent's refresh token is revoked | The refresh fails; the agent reports `tokenValid: false`; the UI shows the login screen |
| A rules mistake exposes data | Clients can read only `orderTracking` (own documents) and the shop's doorbell (no data). Rules tests for both. |
| Writes to active orders multiply board fetches | 6.4 rules; debounce; fetch only while visible |
| Staff keep access up to 1 h after deactivation | Sensitive routes check revocation (6.1) |
| A paid order waits while no PC runs | The customer warning after 10 minutes (5.5) |
| The free tier is exceeded | Budget alerts. Overage at 1,000 orders/day is well under $1/month. |

---

## 12. Testing

- **Unit tests:**
  - **Server:** `sync`, `report` (leases, replays, READY, shred retry), `board?since=`, the ring helper, claims-based auth.
  - **Agent** (xUnit with a fake HTTP handler): SSE parsing, token refresh, the watchdog, sync-on-change, the outbox.
  - **Desktop** (Vitest): board merging, visible-only fetching.
- **Rules:** both emulators.
- **End to end on a staging project and real Windows PCs:**
  - Payment to claim, with the window **minimized for an hour**: p95 under 2 s (warm).
  - CASH order: native notification while minimized, then accept, then print.
  - App closed when a paid order arrives: it waits, then prints when the app opens.
  - Network drops of 2 and 40 minutes, sleep and resume: no missed jobs.
  - Token renewal over a 3-hour session: no 401s.
  - Two PCs: one accept; jobs go to the accepting PC.
  - An idle PC for 1 hour: 0 API requests, 0 Firestore reads, and doorbell bytes as in 10.2.
  - Reads, writes and requests per order within ±20% of 10.1.

---

## 13. Rollout and effort

There are no existing users, so each phase replaces the old path outright.

| Phase | Contents | Rough effort |
| --- | --- | --- |
| 0 | Firebase project setup, the doorbell spike (7.1, **done**), shop-network field checks, spike clean-up | 1.6 days left |
| 1 | 6.1–6.5: the mock-payment gate (first), local token checks, rules and indexes for both databases, data changes, ring helper, counters and alerts | about 6.35 days |
| 2 | 7.2–7.5: agent token, doorbell, sync and outbox; agent lifetime; server sync/report/board/history endpoints with re-delivery and job rescue; desktop board and native notifications; removals | about 10.5 days |
| 3 | 8.1–8.3: tracking listener, guest trims, `minInstances: 0` | about 3.5 days |

The task-level breakdown is in the [implementation plan](./TRAFFIC_SCALING_V2_IMPLEMENTATION.md#13-work-breakdown).

---

## 14. Decisions (accepted 15 Oct 2026)

Accepted with the design. Each can be revisited on its own.

1. **The agent auto-accepts paid orders** during `sync`, so paid orders wait while no PC is on. *Default: yes.*
2. **Up to 1 hour of access after a staff member is deactivated.** Sensitive routes are immediate. *Default: accept.*
3. **Realtime Database for the doorbell,** in `asia-southeast1`. *Default: yes.*
4. **The desktop has no Firebase SDK;** the board comes from the API. *Default: yes; revisit with 9.3 if board reads grow.*
5. **Guest tracking:** a tracking copy with guest sign-in (about 6 writes per order). *Default: yes.*
6. **Old READY orders:** flag ones older than 3 days in the UI; no automatic status change. *Default: flag only.*
7. **Web app proxy:** keep it until about 2,000 orders/day. *Default: keep.*
8. **`minInstances: 0`** after Phase 2. *Default: yes.*
9. **No safety sync on a timer.** A ring that never lands leaves paid orders and queued jobs waiting until the next work ring, an agent restart, the desktop's stale-work nudge, or "Sync now". The alternative is one `sync` per PC each time the stream reconnects for the hourly token. That bounds the wait to about an hour, and costs about 12 k requests and up to 24 k reads a day at 1,000 PCs (about $0.50/month), but it ends "idle means zero". *Default: no timer; turn it on if the `ring_failed` alert fires in practice.*
10. **The agent exits with the desktop app.** Today it outlives the window and keeps printing with no one watching; nothing clears its credential at sign-out either. Tying it to the app (`--parent-pid`) keeps "closed app → paid orders wait" true, gives the shop an obvious way to stop taking orders, and lets the agent mark its printers OFFLINE on the way out. The alternative is to keep it running without the window: more uptime, but it would need a tray icon with "Pause orders" and a quit option, and it moves toward 9.2. *Default: exit with the app.*
11. **Desktop sign-out doesn't revoke refresh tokens.** Revoking signs the same login out on every PC within the hour. Revocation stays for staff deactivation and an explicit "sign out all devices". *Default: don't revoke.*

---

## 15. Not verified yet

- **Doorbell** (measured on the dev PC in 7.1; these remain for real shops, implementation plan 3.3):
  - behaviour behind shop proxies and antivirus HTTPS scanning, and on mobile hotspots;
  - reconnect after a 40-minute cut and after sleep/resume;
  - bytes per connection-hour from the Firebase console (the spike's figure is a client-side estimate);
  - a 307 redirect from the real database (none was seen).
- **Simultaneous connections:** whether REST streams count toward the 200 k limit (irrelevant at 1,000 PCs).
- **Firestore region and prices.**
- **Identity Platform:** if enabled, each guest who signs in counts as a monthly active user (50 k free, then about $0.005 each). The repo shows no sign of it; check the console before P3-01. It doesn't matter at 1,000 orders a day, but dominates the cost at 10,000.
- **Per-order counts** in 10.1 are estimates from reading the code.
- **Cold-start time** of the API on App Hosting.

---

## Appendix A. Contract changes

| Kind | Change | Phase |
| --- | --- | --- |
| Auth | Custom claims required; local `verifyIdToken` | 1 |
| Response | `POST /api/v1/public/shops/{slug}/session` adds `firebaseToken` (uid = `printUserId`) | 1 |
| Fields | Order: `lifecycle` gains `printingAt`, `rejectedAt`, `cancelledAt`, `paidAt`; new `completedDocumentIds`, `searchKeys`; `updatedAt` is the server timestamp on orders and jobs; device: `lastActiveAt` | 1 |
| Collections | New Firestore `orderTracking/{orderId}`; new Realtime Database `/doorbell/{shopId}` | 1 |
| Removed | `statusHistory`; job `PRINTING`; claim, report and transition idempotency documents | 1 |
| Endpoint | `POST .../agents/{agentId}/sync`, `POST .../agents/{agentId}/jobs/report` | 2 |
| Endpoint | `GET .../board?since=`, `GET .../orders?status=&from=&to=&cursor=`, `GET .../orders/search?q=` | 2 |
| Pipe | UI → agent: `cloud.configure`, `cloud.session`, `cloud.clear`, `sync.request` (notifications); `cloud.getIdToken` (request). Agent → UI: `board.changed`, `orders.attention`, `cloud.state`. | 2 |
| Behaviour | Payment confirmation no longer auto-accepts; the agent's `sync` does. Accept routes to the caller's printers first. Retry also rescues QUEUED and stuck DISPATCHING jobs. The agent exits with the app. | 2 |
| Behaviour | `POST /api/auth/logout` takes `{ allDevices? }` and revokes only when it's true. Registration returns a token with claims. The mock payment route needs `ALLOW_MOCK_PAYMENTS`. | 1 |
| Removed | Heartbeat; agent jobs list; per-job claim, PATCH, document and shred routes; SSE stream; full order list; agent API key | 2 |
| Removed | Guest tracking poll | 3 |

## Appendix B. Rules (drafts)

**Firestore:**

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Customer-safe copy of a guest order. Guests sign in with uid = printUserId.
    match /orderTracking/{orderId} {
      allow get: if request.auth != null
        && resource.data.printUserId == request.auth.uid;
    }
    // Everything else is server-only (the Admin SDK bypasses rules).
  }
}
```

**Realtime Database:**

```text
{
  "rules": {
    ".read": false,
    ".write": false,
    "doorbell": {
      "$shopId": {
        ".read": "auth != null && auth.token.shopId === $shopId"
      }
    }
  }
}
```

Neither set reads other documents, so rule checks cost nothing extra.

## Appendix C. Firestore indexes

| Collection | Scope | Fields | Used by |
| --- | --- | --- | --- |
| `printJobs` | Collection group | `shopId` ASC, `agentId` ASC, `status` ASC, `createdAt` ASC | `sync` claim |
| `printJobs` | Collection group | `shopId` ASC, `agentId` ASC, `status` ASC, `claimedAt` ASC | `sync` re-delivery |
| `printJobs` | Collection group | `shopId` ASC, `status` ASC | Board: unfinished jobs |
| `printJobs` | Collection group | `shopId` ASC, `updatedAt` ASC | Board: job changes |
| `orders` | Collection | `status` ASC, `payment.status` ASC | `sync` auto-accept |
| `orders` | Collection | `status` ASC, `createdAt` DESC | History filtered by status |
| `orders` | Collection | `searchKeys` ARRAY_CONTAINS, `createdAt` DESC | Search |

Single-field automatic indexes cover the board's active orders (`status in [...]`) and order changes (`updatedAt >`).

## Appendix D. Settings

| Setting | Value | Owner |
| --- | --- | --- |
| Doorbell region | `asia-southeast1` | Firebase |
| Agent token refresh | At 55 minutes, or on `auth_revoked` or 401 | Agent |
| Stream watchdog | 65 s with no event (keep-alive measured at 30 s) | Agent |
| Stream reconnect backoff | 1 s doubling to 60 s with jitter, after failed connects only; cut short by network-change and resume events | Agent |
| Doorbell poll fallback | 60 s for 30 minutes, after 3 broken streams in a row (offline attempts don't count) | Agent |
| `sync` batch | Up to 10 accepts, 10 claims and 10 re-deliveries; repeat while `more` | Agent → API |
| Stuck job | DISPATCHING for more than 15 minutes: re-delivered by `sync`, and the operator may retry it elsewhere | API |
| Agent download URL | 60 minutes | API |
| Report retry | 1 s doubling to 5 min; network, 429 and 5xx only | Agent |
| Board refresh | On `board.changed`, debounced 300 ms, only while visible; once on focus | Desktop UI |
| Board overlap | `updatedAt > since − 5 s`, de-duplicated | API, UI |
| Ring retry | Once, then log: `ring_unknown` on timeout, `ring_failed` on an error | API |
| `lastActiveAt` write | At most every 10 minutes, only on existing requests | API |
| "Shop hasn't confirmed" warning | 10 minutes in `SUBMITTED` | Web app |
| Shop config cache | 60 s per instance | API |
| `minInstances` | 0 after Phase 2 | App Hosting |

## Appendix E. Sources

- [Firestore pricing and listener billing](https://firebase.google.com/docs/firestore/pricing)
- [Realtime Database REST streaming](https://firebase.google.com/docs/database/rest/retrieve-data)
- [Realtime Database REST authentication](https://firebase.google.com/docs/database/rest/auth)
- [Realtime Database billing](https://firebase.google.com/docs/database/usage/billing)
- [Firebase pricing (Realtime Database limits)](https://firebase.google.com/pricing)
- [App Hosting costs](https://firebase.google.com/docs/app-hosting/costs)
- [App Hosting request timeout (product comparison)](https://firebase.google.com/docs/app-hosting/product-comparison)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud Run: streaming connections keep an instance active](https://docs.cloud.google.com/run/docs/triggering/websockets)
- [Tauri 2.3 background throttling option (WebKit only)](https://v2.tauri.app/release/tauri-runtime/v2.4.0/)

## Related docs

- [`PRINT_SHOP_DESKTOP.md`](./PRINT_SHOP_DESKTOP.md): desktop architecture.
- [`Order_to_Print_Execution_Runbook.md`](../developer-requirement/desktop-app/Order_to_Print_Execution_Runbook.md): order-to-print flow.
- [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md): App Hosting limits and run settings.
- [`apps/server/docs/print-user.md`](../../apps/server/docs/print-user.md): guest upload and checkout API.
