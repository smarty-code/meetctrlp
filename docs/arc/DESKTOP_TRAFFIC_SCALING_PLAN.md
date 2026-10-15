# Desktop traffic and server load: serverless plan

> **Status:** Proposed, version 2, 15 Oct 2026. Nothing in this document is implemented yet. Version 1, built around a server-side hub and SSE, is in git history (`ccadc8b`).
> **Hosting:** Firebase App Hosting (serverless, on Cloud Run). See [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md).
> **Implementation plan:** [`TRAFFIC_SCALING_V2_IMPLEMENTATION.md`](./TRAFFIC_SCALING_V2_IMPLEMENTATION.md) lists the file-level changes, contracts, work breakdown and tests. Where the two differ, the implementation plan is newer.
> **Scope:** `apps/server`, `apps/print-shop` (desktop UI), `apps/print-agent` (C# agent), and the customer web app `apps/printUserWebapp`.
> **Problem:** every open shop desktop sends requests on timers, and each request does slow, billable work. Cost grows with every installed desktop, even when no orders arrive.

---

## 1. Summary

**The idea:** nothing runs on a timer through our server. Firestore's own realtime listeners carry every "something changed" signal to the desktop and the customer. Our server only runs when someone actually does something: a customer uploads or pays, the shop accepts, an agent claims or finishes a job.

- **Jobs arrive almost instantly.** The desktop listens to the shop's unfinished print jobs in Firestore. When one is queued, the desktop tells its agent over the existing named pipe, and the agent claims it with one request. Expected time from the job being queued to the agent starting the download is under about 2 seconds (to be measured, section 12).
- **An idle desktop costs nothing.** No heartbeat, no job poll, and no order stream. A Firestore listener that sees no changes is not billed, and it doesn't keep any of our instances running.
- **The server is stateless.** There's no hub, no SSE, no in-memory state to rebuild, and no 5-minute stream cuts to work around. It can scale to zero.
- **Logins are checked without network calls or reads.** Login tokens are verified locally, and the shop and role come from claims stored in the token itself.
- **Online status is relaxed, as agreed.** A paid order is accepted by a running desktop rather than by the server, so "accepted" proves a PC is on. Customers see a warning if no desktop picks up their order.
- **Cost:** at 1,000 shops with the app open all day and 1,000 orders a day, usage lands at about the free tier. Idle desktops add nothing, and any overage is well under $1/month (section 10).

| 1,000 shops open 12 h/day, 1,000 orders/day | Today | Plan v1 after Phase 3 | **This plan** |
| --- | --- | --- | --- |
| Our server requests/day | ~2.9 M | ~260 k | **~37 k** |
| Firestore reads/day | ~8.6 M | ~0.3 M | **~55–60 k** |
| Firestore writes/day | ~1.4 M | ~0.3 M | **~30 k** |
| Instances kept running by open streams | 1+ all day | 1–13 all day | **none** |
| Cost while no orders arrive | ~$120–235/month | ~$85+/month | **~$0** |

---

## 2. Requirements and budget

### 2.1 Requirements

| Requirement | Target |
| --- | --- |
| A queued job reaches the shop's agent | Almost instantly: a few seconds at most |
| Shop/agent online status | Can lag by 5–10 minutes. Not a priority. |
| Cost | As close to the free tier as possible at about 1,000 shops/customers |
| Existing users | None. Contracts and data can change freely, with no backward compatibility. |

### 2.2 Free tier

Usage is pooled per billing account. App Hosting requires the Blaze plan; these are its no-cost amounts.

| Resource | Free amount | Per day | Price above it |
| --- | --- | --- | --- |
| Firestore document reads | 50,000/day | 50,000 | ~$0.03–0.06 per 100 k (by region) |
| Firestore document writes | 20,000/day | 20,000 | ~$0.09–0.18 per 100 k |
| Firestore deletes | 20,000/day | 20,000 | ~$0.01–0.02 per 100 k |
| Cloud Run requests (both backends together) | 2 M/month | ~66,000 | $0.40 per million |
| Cloud Run CPU while handling requests | 180,000 vCPU-s/month | ~6,000 vCPU-s | $0.000024 per vCPU-s |
| Cloud Run memory while handling requests | 360,000 GiB-s/month | ~12,000 GiB-s | $0.0000025 per GiB-s |

Sources are listed in Appendix E. Check prices for your Firestore database's region.

### 2.3 How Firestore bills listeners

This is the rule the whole plan is built on:

- **Changes are billed, not connections.** A listener costs one read when a document enters or changes in its results, and one read when a document leaves its results because it changed. An open listener with no changes costs nothing.
- **Each query costs at least one read**, even when it returns nothing.
- **Long gaps cost a full re-read.** A listener that reconnects after being offline for more than 30 minutes is billed as a new query (with the local cache enabled). Without the local cache, every reconnect is billed as a new query, so the cache must be on.
- **Rules that read documents cost reads.** `get()` and `exists()` in security rules are billed, so the rules in Appendix B use only token claims.
- **Our server runs nothing for listeners.** Google's servers deliver the updates.

---

## 3. What happens today

Findings from reading the code. Paths are relative to the repo root.

### 3.1 Requests on timers

| Request | Sent by | How often | Cost per request |
| --- | --- | --- | --- |
| `POST /api/v1/devices/heartbeat` | Desktop UI ([`App.tsx`](../../apps/print-shop/src/App.tsx), `setInterval`) | Every 30 s, overlapping when slow | 1 call to Google to check the token, ≥4 reads, ≥1 write |
| `GET /api/v1/shops/{shopId}/agents/{agentId}/jobs` | C# agent ([`AgentCloudSynchronizer.cs`](../../apps/print-agent/src/Ctrlp.PrintAgent.Core/Cloud/AgentCloudSynchronizer.cs)) | 3 s after work, backing off to 30 s when idle | 2 reads (credential, job query) |
| `GET /api/v1/shops/{shopId}/orders/stream` (SSE) | Desktop UI ([`cloud.ts`](../../apps/print-shop/src/lib/cloud.ts)) | Always open. App Hosting cuts it every 5 minutes, then it reconnects. | Each connection re-reads **every** order and print job the shop has ever had (`subscribeShopOrders` in [`order.service.ts`](../../apps/server/src/modules/orders/order.service.ts)) |
| `GET /api/v1/shops/{shopId}/orders` | Desktop UI | Each time the stream starts | The full order history |
| `GET /api/v1/public/session/orders/{orderId}` | Customer tracking page ([`tracking-constants.ts`](../../apps/printUserWebapp/src/data/tracking-constants.ts)) | Every 6 s until the order is completed, including the whole time it's READY | Session, order, and its whole `statusHistory` |

### 3.2 Other findings

- **Auth is slow on every desktop request.** `requireShopUser` in [`auth.service.ts`](../../apps/server/src/modules/auth/auth.service.ts) calls Google (`accounts:lookup`) and then makes 2 reads. `verifyIdToken` isn't used anywhere.
- **Expired tokens cause a request storm.** The desktop never refreshes its 1-hour ID token after startup. After an hour, every heartbeat fails and the stream retries every ≤10 s, each attempt another failed check with Google.
- **Jobs aren't queued at submit.** `queueIncomingOrder` in [`print-job.service.ts`](../../apps/server/src/modules/printing/print-job.service.ts) runs once an order is `SHOP_ACCEPTED`:
  - by a manual accept (always needed for CASH);
  - by the server auto-accepting a paid ONLINE order (`confirmOnlinePayment`).

  Jobs are written to `shops/{shopId}/orders/{orderId}/printJobs/{jobId}` with `shopId`, `agentId`, `printerId` and `status: QUEUED`.
- **Paid orders are auto-accepted into a dead queue.** The server auto-accepts a paid order even when no desktop is running, and the job then sits QUEUED.
- **Printers are never marked offline.** Routing (`routePrintJob`) uses each printer's `status`, which is never set to OFFLINE when the app closes.
- **Agent online status has no reader.** The agent's `status`/`lastSeenAt` are written on every heartbeat but read only by the sweep that marks agents stale.
- **About 5–7 agent requests per job:** claim, document ticket, a status `PATCH` for every local job event, a shred confirmation, and re-reports.
- **The agent dies with the app.** It's a sidecar spawned by Tauri and killed when the app exits. It talks to the UI over the named pipe `\\.\pipe\ctrlp-print-agent` (JSON-RPC). Nothing over that pipe tells it to check for jobs.
- **No app uses the Firebase client SDK.** No `firebase.json` exists. Security rules and indexes exist only as drafts in [`packages/firebase/docs/`](../../packages/firebase/docs/).

### 3.3 Cost of today's code

Per desktop that's open, per hour: about **240 requests, 720 reads and 120 writes** (heartbeat + job poll), plus a full history re-read at least every 5 minutes from the stream. Three desktops left open around the clock use up the whole free read quota. At 1,000 desktops open 12 hours a day, that's about 2.9 M requests, 8.6 M reads and 1.4 M writes a day, about $120–235/month of Firestore before any orders.

---

## 4. Why version 1 of the plan doesn't fit serverless

Version 1 kept a live view of each shop in server memory (the "hub"), served desktops over SSE, and added an SSE stream for agents. On App Hosting:

- **Open streams keep instances billed all day.** Cloud Run treats an instance with an open streaming request as active and bills it at the full rate. One instance kept busy all day costs about $63/month above the free tier. 1,000 desktop streams at the default 80 requests per instance need about 13 instances.
- **Short-lived instances lose their memory.** Instances scale to zero, restart, and multiply. A hub or cache rebuilt on each new instance pays its startup reads again, and a reconnect may land on a different instance with a different hub.
- **Streams are cut every 5 minutes.** At least 12 reconnects an hour per desktop, each needing replay logic to stay cheap.
- **Timers still dominated.** Even after Phase 3, about 3 requests per second and 0.3 M reads and writes a day were left, mostly safety polls and presence writes. That's several times the free tier, before any orders.

What still holds from version 1 and is kept here:

- verifying tokens locally (7.1);
- stopping retries on permanent rejections (8.3);
- bounding the desktop's live view to active orders (7.4);
- paging history instead of loading it all (8.4);
- request counters and budget alerts (7.5).

---

## 5. Target design

```text
                       writes (transactions, Admin SDK)
 Customer web app ──▶  API on Cloud Run  ──────────────────▶  Firestore
 Shop desktop UI ──▶   (stateless, scales to zero)                │
 Print agent ────▶                                                │ realtime listeners
                                                                  │ (Google's servers; billed per changed document)
                        ┌─────────────────────────────────────────┤
                        ▼                                         ▼
              Shop desktop UI (Tauri)                    Customer tracking page
              • live board: active orders                • its own order document
              • unfinished print jobs
                        │
                        │ named pipe: "jobs.available"
                        ▼
              Print agent ── claim / report ──▶ API
                        │
                        └── download ──▶ Railway storage (presigned URL)
```

### 5.1 Principles

1. **Idle means zero.** No client sends anything on a timer through our server.
2. **Firestore is the push channel.** Clients read through listeners scoped by security rules. All writes still go through the API, in transactions.
3. **The server holds no state.** Everything it needs comes from the request or from Firestore. A cache is only a bonus for a warm instance.
4. **Batch per event, not per step.** One claim per wake-up, one final report per job, no intermediate status calls.
5. **Never trust a single signal.** The agent reacts to the *current set* of queued jobs, not to individual events, so a missed event can't strand a job.

### 5.2 How a job gets to the agent

Example: an ONLINE order with 2 files, API instance warm. Times are estimates to measure in section 12.

| Time | What happens | Who |
| --- | --- | --- |
| 0 | The customer pays. The server marks the order paid (still `SUBMITTED`). | API |
| ~0.5 s | The desktop's live board sees a paid, unaccepted order. Auto-accept is on, so it calls `accept`. | Firestore listener → desktop |
| ~0.8 s | The server accepts the order and queues its 2 jobs, routed to this PC's agent first, in one transaction. | API |
| ~1.3 s | The desktop's jobs listener sees 2 QUEUED jobs for its agent and sends `jobs.available` over the pipe. | Firestore listener → desktop → agent |
| ~1.6 s | The agent claims both jobs in one request. The response includes presigned download URLs. | Agent → API |
| then | Download from Railway, print, delete the local file. | Agent |
| at the end | One final report per job. When every job is done, the order becomes `READY`. | Agent → API |

- **CASH orders:** the same path, with a person pressing Accept instead of auto-accept.
- **Cold start:** if the instance is cold, add about 2–5 s. The customer's own requests just before usually warm it.

### 5.3 What each client reads

| Listener | Query | Billed reads |
| --- | --- | --- |
| Desktop live board | `shops/{shopId}/orders` where `status in [SUBMITTED, SHOP_ACCEPTED, PRINTING, READY]` | Active orders when it starts (at least 1), then 1 per order change |
| Desktop jobs | collection group `printJobs` where `shopId ==` and `status in [QUEUED, DISPATCHING, FAILED]` | Unfinished jobs when it starts (at least 1), then 1 per job change |
| Customer tracking | the document `orderTracking/{orderId}`, a customer-safe copy of the order | 1 to start, then 1 per visible change |
| Desktop history, search, today's completed | One-off client queries, paged by 50, run only when the shop opens that tab | 1 per order shown |

### 5.4 Who signs in how

| Client | Signs in with | Server checks | Firestore rules use |
| --- | --- | --- | --- |
| Shop desktop | Firebase client SDK, `signInWithCustomToken` with a token from `/api/auth/login`. The SDK refreshes the ID token by itself. | `verifyIdToken` locally. `shopId`, `shopUserId` and `role` come from custom claims. 0 reads. | `request.auth.token.shopId` |
| Print agent | The signed-in desktop user's ID token, handed over the pipe whenever it changes | Same as the desktop. Job actions also check `job.shopId` and `job.agentId` inside the claim/report transaction. | — (no direct Firestore access) |
| Customer | A custom token for `uid = printUserId`, returned when the guest session starts. Used only on the tracking page. | Signed guest cookie | `orderTracking`: `resource.data.printUserId == request.auth.uid` |

Customers read a separate tracking copy, not the order itself. Security rules allow or deny whole documents, so pointing a guest at the order would also expose staff IDs, payment references and storage keys.

The agent's separate API key (`x-ctrlp-agent-key`) goes away. That saves a credential read on every agent request, and leaves one auth system to maintain.

### 5.5 Online status, kept cheap

| Need | How it's met | Cost |
| --- | --- | --- |
| Don't auto-accept a paid order no PC will print | The **desktop** auto-accepts paid orders when it sees them. The server no longer auto-accepts. If no desktop is running, the order waits as `SUBMITTED` and paid. | 1 request per order, which replaces the server's own accept |
| Don't route jobs to a PC that's off | `accept` routes to the accepting PC's printers first. Printers are marked OFFLINE on sign-out and on app exit (best effort). | 1 request per exit |
| Tell the customer the shop hasn't seen the order | The tracking page shows "The shop hasn't confirmed your order yet" when the order is still `SUBMITTED` 10 minutes after payment or submission. | 0 |
| "Last active" in admin views | The device's `lastActiveAt` is written at sign-in, and added at most every 10 minutes to requests the desktop already makes. | ≤6 writes per active hour, 0 when idle |

A live "online now" indicator isn't needed (section 2.1). If it becomes one, see 9.1.

### 5.6 What's removed

| Removed | Replaced by |
| --- | --- |
| `POST /api/v1/devices/heartbeat` and the desktop's 30 s loop | Nothing. Online status per 5.5. |
| Agent poll loop and `GET .../agents/{agentId}/jobs` | `jobs.available` over the pipe, plus a batch claim |
| `GET .../orders/stream` (SSE) and `subscribeShopOrders` | The desktop's live-board and jobs listeners |
| Full `GET .../orders` at startup | The live-board listener, plus paged client queries for history |
| `GET .../jobs/{jobId}/document` (ticket), per-event `PATCH .../jobs/{jobId}`, `POST .../documents/{docId}/shred` | Claim returns download URLs. One final report also confirms the shred. |
| `markStaleAgentsOffline` and the agent `status` field | `lastActiveAt` (5.5) |
| Version 1's hub, agent stream and presence-from-stream | Not built |
| Tracking poll every 6 s | Tracking listener |
| Manual token refresh code (version 1, 8.1) | The Firebase SDK refreshes tokens |

---

## 6. Phase 1: foundation (server and Firebase config)

Everything Phases 2 and 3 depend on. Clients don't change yet.

### 6.1 Verify tokens locally, trust claims

**Where:** `requireShopUser` in [`auth.service.ts`](../../apps/server/src/modules/auth/auth.service.ts), registration and staff management.

- Replace `lookupIdToken` with `getFirebaseAuth().verifyIdToken(token)`. It checks the signature against Google's cached public keys, with no network call per request.
- Set custom claims `{ shopId, shopUserId, role }` with `setCustomUserClaims` at registration and whenever staff are added or their role changes. Claims set this way persist across token refreshes.
- Read `shopId`, `shopUserId` and `role` from the token. No `authLookups` or user read on the request path.
- **Deactivating staff:** disable the Firebase user and call `revokeRefreshTokens`. Ordinary routes and Firestore reads stop working when the current ID token expires (within 1 hour). Sensitive routes (staff management, payout settings, sign-out) call `verifyIdToken(token, true)`, which checks revocation immediately with one call to Google.

**Effect:** desktop requests lose a call to Google (300–800 ms) and 2 reads each.

### 6.2 Custom tokens for the client SDK

- `/api/auth/login` and `/api/auth/refresh` also return `firebaseCustomToken` from `createCustomToken(uid)`. It's signed locally with the service-account key, so no network call.
- `POST /api/v1/public/shops/{slug}/session` returns `firebaseToken` for `uid = printUserId`, with claim `guest: true`.

### 6.3 Security rules, indexes and deploy config

- Add `firebase.json` with Firestore rules and indexes. Move the drafts out of [`packages/firebase/docs/`](../../packages/firebase/docs/) into `packages/firebase/firestore.rules` and `packages/firebase/firestore.indexes.json`.
- Rules: Appendix B. Clients can only read, never write, and only their own shop's orders and jobs, or the guest's own order.
- Indexes: Appendix C.
- Test the rules with the Firestore emulator: a shop can't read another shop's orders, a guest can read only their own order, and no client can write.

### 6.4 Data changes that keep reads and writes down

Each write to an active order costs one read for every desktop and customer listening to it. So:

- **Status times on the order:** extend the order's existing `lifecycle` map (`printingAt`, `rejectedAt`, `cancelledAt`, `paidAt`) and drop the `statusHistory` subcollection. That saves one write per status change, and the reads of the whole subcollection.
- **Completed documents:** keep `completedDocumentIds` on the order. Each final report adds its document with `arrayUnion`, so a report doesn't read every sibling job. The report that completes the last document sets `READY` in the same write.
- **Fewer job states:** jobs go `QUEUED → DISPATCHING` (claimed) `→ COMPLETED | FAILED`. Drop the separate `PRINTING` write.
- **Idempotency without extra documents:**
  - Claims and reports are made idempotent by the job's `leaseId`.
  - Order transitions are made idempotent by their status: a replay finds the target status already set and writes nothing.
  - Keep idempotency keys for customer order submission and dispatch.
- **Customer tracking copy:** `orderTracking/{orderId}` holds only customer-visible fields. It's written in the same transaction as the order, and only when one of those fields changes (about 6 writes per order).
- **Search keys:** write `searchKeys` (order number, pickup code, phone, filename words, lowercased) when the order is created, for the desktop's search (7.7).
- **No needless writes:** don't bump `updatedAt` or touch active orders unless something visible changed.

### 6.5 Visibility and guard rails

- **Counters:** log reads and writes per request (a small counter around the Firestore helpers), with route and duration.
- **Budget alerts:** Firestore and Cloud Run budget alerts at 50%, 90% and 100% of the free tier.
- **Rate limits:** a per-instance limiter per user, agent and guest (for example 30 requests/minute) that answers 429 with `Retry-After`. On serverless this only guards against a client stuck in a loop. It's not abuse protection; App Check covers that later.

---

## 7. Phase 2: push through Firestore (desktop, agent, server)

### 7.1 First, test listener delivery on a minimized window (spike, 1 day)

The desktop must receive jobs while its window is minimized, which is how shops will run it. Tauri's option to turn off background throttling covers only macOS/Linux WebKit, not WebView2 on Windows.

**Test:**

1. Minimize the app for an hour.
2. Queue jobs from another machine.
3. Measure the delay from the job being queued to the agent being woken. Try it also with the network dropped and restored while minimized.

**If delivery lags while minimized,** use fallback F2 in 9.3 (the listener runs in the agent instead). The rest of this phase is the same either way.

### 7.2 Firebase in the desktop

**Where:** new `apps/print-shop/src/lib/firebase.ts`; sign-in in [`App.tsx`](../../apps/print-shop/src/App.tsx).

- Initialise Firestore with the local cache on (`persistentLocalCache`). Without it, every reconnect is billed as a new query.
- After login, call `signInWithCustomToken(firebaseCustomToken)`. From then on, use `auth.currentUser.getIdToken()` for every API call. The SDK refreshes it before it expires, which removes the token storm in 3.2.
- On `onIdTokenChanged`, send the new token to the agent over the pipe (`cloud.session`).
- Keep the token out of React effect dependencies, so a refresh doesn't restart the listeners.

### 7.3 Live board and jobs listeners

- **Live board:** replaces the SSE stream and the full `listShopOrders` call. Map documents to the existing order types.
- **Jobs:** shows progress in the UI and drives the agent (7.4).
- **Detach on sign-out.** Attach once per sign-in, not per screen.

### 7.4 Waking the agent

**Where:** the pipe protocol ([`Protocol.cs`](../../apps/print-agent/src/Ctrlp.PrintAgent.Contracts/Protocol/Protocol.cs), `commands.rs`, [`agent.ts`](../../apps/print-shop/src/lib/agent.ts)).

- **New notification from UI to agent:** `jobs.available { jobs: [{ orderId, jobId }] }`, every QUEUED job whose `agentId` is this PC's agent.
- **When it's sent:** on every jobs snapshot that contains such jobs, and again whenever the agent reconnects to the pipe. It reflects the current state, so a missed event or an agent restart can't lose a job.
- **The agent de-duplicates.** It ignores job IDs it's already claiming or printing.

### 7.5 Agent: no polling

**Where:** [`AgentCloudSynchronizer.cs`](../../apps/print-agent/src/Ctrlp.PrintAgent.Core/Cloud/AgentCloudSynchronizer.cs).

- **Remove the poll loop.** The agent is idle until `jobs.available` arrives.
- **Claim:** one call for the batch → stage → print (unchanged locally) → delete the local file → one final report.
- **Retries:** reports are retried with backoff (1 s doubling to 5 minutes) only on network errors, 429 and 5xx, honouring `Retry-After`.
- **Permanent rejections:** a 404 or 409 is permanent. Log it, mark it acknowledged, stop. This closes the "re-sent every 3 seconds forever" bug.
- **On start,** re-send any unacknowledged final reports once, then only on the backoff schedule.
- **Auth:** the latest token from `cloud.session` replaces the agent API key.
- **Tests:** a fake HTTP handler for claim, report, backoff and permanent rejections (none exist today).

### 7.6 Server: claim and report endpoints

**Where:** [`print-job.service.ts`](../../apps/server/src/modules/printing/print-job.service.ts), new routes under `app/api/v1/shops/[shopId]/agents/[agentId]/jobs/`.

- **`POST .../jobs/claim`** with `{ jobs?: [{ orderId, jobId }] }`. In one transaction it claims up to 10 of those jobs that are still QUEUED for this agent: sets `DISPATCHING` with a new `leaseId`, and moves the order to `PRINTING` on its first claim.
  - It returns each job with `resolvedSettings` and a presigned download URL, replacing the ticket route.
  - Without `jobs` it claims the oldest QUEUED jobs for this agent (used by fallback F2 and recovery).
- **`POST .../jobs/report`** with `{ reports: [{ orderId, jobId, leaseId, status: COMPLETED | FAILED | CANCELLED, error?, pagesPrinted? }] }`. For each report:
  - it checks the lease;
  - it sets the final status;
  - on COMPLETED, it adds the document to `completedDocumentIds`, setting the order to `READY` once all documents are done;
  - on COMPLETED, it then deletes the storage object and records `shreddedAt`. The report counts as done only once the object is deleted.
- **Remove** the routes listed in 5.6.

### 7.7 Accepting orders from the desktop

- **Auto-accept moves to the desktop.** When the live board shows a paid ONLINE order still in `SUBMITTED`, and `autoAcceptPaidOnline` is on, the desktop calls `accept`. CASH orders still need a person to press Accept.
  - The server keeps the transaction idempotent, so two PCs racing get one accept and one no-op.
  - Remove auto-accept from `confirmOnlinePayment`.
- **Routing:** `accept` queues jobs for the accepting PC's printers first, if they have the needed capabilities, and falls back to other printers in the shop.
- **Printers on exit:** mark this PC's printers OFFLINE on sign-out and on app exit (best effort).
- **Optional later:** `accept` could return the claimed jobs for the local agent directly, saving the listener round trip (about 0.5 s).

### 7.8 History and search in the desktop

The Orders screen's All, Completed, date and search views run Firestore queries from the desktop, paged by 50 and only when that view opens:

- `orders` by `createdAt` desc, optionally filtered by status or date;
- search through `searchKeys array-contains`.

No server endpoint is needed.

---

## 8. Phase 3: customer side and cost trims

### 8.1 Tracking with a listener

**Where:** [`use-order-tracking.ts`](../../apps/printUserWebapp/src/hooks/use-order-tracking.ts), [`tracking-repository.ts`](../../apps/printUserWebapp/src/data/tracking-repository.ts).

- On the tracking page only, load the Firebase SDK (dynamic import), sign in with the session's `firebaseToken`, and listen to `orderTracking/{orderId}`.
- Detach when the order is `COMPLETED`, `REJECTED` or `CANCELLED`, or when the page closes.
- Show "The shop hasn't confirmed your order yet" after 10 minutes in `SUBMITTED` (5.5).
- Remove the 6 s poll and the server's `statusHistory` read for guests.

**Effect:** from about 10 requests and 30–70 reads a minute per waiting customer, to about 7 reads and 0 requests per order.

### 8.2 Guest API trims

- **Signed session cookie:** sign the guest cookie (`printUserId`, shop, IP hash, expiry, HMAC) so `requirePrintUserSession` doesn't read `printUsers/{id}` just to authenticate. Cart changes still read it inside their transaction.
- **Read the session once per request.** `complete` reads it three times today.
- **Cache shop config** for 60 s per instance. Most of one customer's requests land on the same warm instance.
- **One quote:** quote once on the review page and pass `expectedTotalPaise` to submit. Don't quote again on the payment page.
- **Keep the cart in memory** between the upload, customize and review pages, and re-read the session only on reload.

### 8.3 Hosting settings

- **Scale to zero:** set `minInstances: 0` in [`apps/server/apphosting.yaml`](../../apps/server/apphosting.yaml) once the SSE stream is gone. This saves the idle instance (about $13/month). A cold start (2–5 s) then hits only the first request after a quiet period, and a customer's own requests usually warm the server before the shop accepts.
- **Update [`deployment.md`](../../apps/server/docs/deployment.md):** remove "Desktop order stream on serverless", and note that listeners need no server capacity.

### 8.4 Web app proxy: keep for now

Every customer API call goes through the web app's `/api` proxy, so it counts as 2 Cloud Run requests. At 1,000 orders/day the total stays within the free tier (section 10), so keep the proxy: it gives first-party cookies and no CORS.

Above about 2,000 orders/day:

- serve the API at `api.<domain>`;
- call it directly with `credentials: "include"` and a same-site cookie;
- send JSON as `text/plain` so browsers skip the CORS preflight request.

This roughly halves customer-side requests.

---

## 9. Optional, only if needed

### 9.1 Live online status with Realtime Database

If a live "online now" indicator, or routing around a PC that crashed, becomes a requirement:

- The desktop connects to Firebase Realtime Database and writes `/presence/{shopId}/{deviceId}`, with `onDisconnect()` removing it.
- Realtime Database bills storage and downloaded bandwidth, not operations: 10 GB/month free, 200 k connections per database.

That gives online status within about a minute at near-zero cost, with no Firestore reads or writes.

### 9.2 Agent as a Windows service

If the agent must print while the desktop app is closed, it needs its own credential again. Use a long-lived signed agent token, verified without a read, plus fallback F2 for jobs.

### 9.3 Fallback F2: listener in the agent

If 7.1 shows WebView2 delays delivery while minimized, the C# agent opens the jobs listener itself. It uses the Firestore .NET client (`Google.Cloud.Firestore`) with the user's Firebase ID token as the bearer credential, so the same security rules apply. The UI keeps only the live board.

This uses the same protocol as Firebase's own mobile SDKs, but it isn't an officially documented setup, so prototype it in the 7.1 spike.

### 9.4 Moving print jobs

Storing jobs at `shops/{shopId}/printJobs/{jobId}` (with `orderId`) instead of under each order would remove the collection-group index and simplify the rules. With no existing data it's cheap to do now, but it's not required.

---

## 10. Cost model

### 10.1 Per order

Scenario: 2 files, ONLINE payment, one desktop listening, the customer watching tracking, after Phases 1–3. These are estimates. The counters in 6.5 will give real numbers.

| Step | Our server requests (with proxy) | Reads | Writes |
| --- | --- | --- | --- |
| Customer opens the shop page and starts a session | 3–4 | ~3 | 1 |
| Upload 2 files (intent + check each) | 8 | ~6 | 4 |
| Customize, review, quote | 5–6 | ~5 | 1 |
| Place the order and pay | 4 | ~6 | ~6 |
| Desktop accepts; 2 jobs queued | 1 | ~5 | ~4 |
| Agent claims 2 jobs and sends 2 final reports | 2–3 | ~7 | ~7 |
| Shop hands over the prints | 1 | ~1 | ~1 |
| Customer tracking copy (written alongside the order) | 0 | 0 | ~6 |
| Desktop listeners (live board + jobs) | 0 | ~13 | 0 |
| Customer tracking listener | 0 | ~7 | 0 |
| Web app page loads | ~5 | 0 | 0 |
| **Total** | **~30–35** | **~50–55** | **~28–30** |

Without the proxy (8.4), requests drop to about 20.

### 10.2 Per day

App start = one sign-in, one device sync, and the two listeners' first results, about 2 requests and 5 reads per desktop.

| Usage | Requests/day | Reads/day | Writes/day | Above the free tier, per month |
| --- | --- | --- | --- | --- |
| 1,000 desktops open, no orders | ~2 k (app starts) | ~5 k | ~1 k | $0 |
| 1,000 desktops + 1,000 orders/day | ~37 k (free: 66 k) | ~55–60 k (free: 50 k) | ~30 k (free: 20 k) | well under $1 |
| 1,000 desktops + 10,000 orders/day | ~350 k | ~550 k | ~300 k | about $45–60 (CPU time ~$20, writes ~$15, reads ~$5–9, requests ~$3) |

**What drives the cost:**

- **Orders, not installed desktops.** Each extra listening desktop adds only about 13 reads per order. Each extra waiting customer adds about 7.
- **Writes to active orders.** Every one is billed again for each listener (6.4).
- **App starts after a long gap.** A listener that comes back after more than 30 minutes re-reads its whole active set, so keep the live board small. This is why it's bounded to active orders.

### 10.3 Against version 1

| 1,000 shops, no orders | Version 1 after Phase 3 | This plan |
| --- | --- | --- |
| Requests/day | ~260 k (safety polls, reconnects) | ~2 k |
| Reads/day | ~0.3 M | ~5 k |
| Writes/day | ~0.3 M (presence) | ~1 k |
| Instances held by streams | 1–13, all day (~$63+ each/month) | 0 |
| Server code | Hub, replay buffer, two SSE endpoints | None of it |

---

## 11. Risks and how they're handled

| Risk | Handling |
| --- | --- |
| WebView2 throttles listeners while minimized | 7.1 spike first; fallback F2 (9.3) |
| A rules mistake exposes another shop's data | Read-only rules using claims only (Appendix B), emulator tests in CI (6.3), no client writes |
| Frequent writes to active orders multiply listener reads | 6.4 rules; the per-request counters (6.5) catch regressions |
| A long-closed app re-reads its live set | Bounded live board; local cache on; decision 4 |
| Staff keep read access up to 1 h after deactivation | Sensitive routes check revocation (6.1); decision 2 |
| A paid order waits when no desktop is running | Customer warning after 10 minutes (5.5); decision 1 |
| A job is missed between events | The agent is woken by the current set of queued jobs, re-sent on every snapshot and every pipe reconnect (7.4) |
| Free tier exceeded | Budget alerts (6.5). Overage at 1,000 orders/day is well under $1/month. |

---

## 12. Testing

- **Unit tests:**
  - **Server:** claim and report (leases, idempotency, `completedDocumentIds`, `READY` after the last document, shred on COMPLETED); claims-based auth.
  - **Agent:** C# tests with a fake HTTP handler.
  - **Desktop:** the `jobs.available` derivation from snapshots (Vitest).
- **Rules:** emulator tests for every allow and deny in Appendix B.
- **End to end on a staging project:**
  - Place 20 orders. Measure p50/p95 from payment to the agent's claim, and from claim to the first page. Target: claim p95 under 2 s with a warm instance.
  - Compare reads and writes per order with section 10.1, using the counters from 6.5.
  - Minimize the desktop for an hour, then queue a job (7.1).
  - Drop the network for 2 minutes and for 40 minutes, and check that no job is missed and how many reads the reconnect costs.
  - Close the app with jobs queued, reopen it, and check the jobs print.
  - Two PCs open: check only one accept happens and jobs route to the accepting PC.

---

## 13. Rollout and effort

There are no existing users, so each phase replaces the old path outright. No compatibility endpoints.

| Phase | Contents | Rough effort |
| --- | --- | --- |
| 0 | Firebase project setup and the minimized-window spike (7.1), run before anything else | 1.5 days |
| 1 | 6.1–6.5: local token checks and claims, custom tokens, rules/indexes/`firebase.json`, data changes, counters and alerts | about 5 days |
| 2 | 7.2–7.8: desktop SDK and listeners, agent wake and rewrite, claim/report endpoints, desktop auto-accept, history queries; remove old routes | about 9.5 days |
| 3 | 8.1–8.3: tracking listener, guest trims, `minInstances: 0`, deployment doc | about 3.5 days |

Effort is a rough estimate for one engineer who knows this code. The task-level breakdown, dependencies and acceptance criteria are in the [implementation plan](./TRAFFIC_SCALING_V2_IMPLEMENTATION.md#13-work-breakdown). Phase 3's web app parts can start once Phase 1 is done.

---

## 14. Decisions (proposed defaults)

1. **Desktop auto-accepts paid orders** instead of the server, so paid orders wait while no PC is on. *Default: yes.*
2. **Up to 1 hour of read access after a staff member is deactivated.** Sensitive routes are immediate. *Default: accept.*
3. **The agent uses the signed-in user's token,** so it doesn't fetch jobs while the app is signed out. *Default: yes; revisit with 9.2.*
4. **Old READY orders:** READY orders stay on the live board until handed over. Flag ones older than 3 days in the UI, but don't change their status automatically. *Default: flag only.*
5. **Guest tracking:** guests sign in and read a tracking copy (`orderTracking/{orderId}`), about 6 extra writes per order. Reading the real order would expose staff IDs, payment references and storage keys, because rules can't hide fields. A copy readable by anyone holding the order ID would skip guest sign-in, but anyone with the link could see the order. *Default: tracking copy with guest sign-in.*
6. **Web app proxy:** keep it until about 2,000 orders/day (8.4). *Default: keep.*
7. **`minInstances: 0`** after Phase 2. *Default: yes.*

---

## 15. Not verified yet

- **Listener latency:** write-to-listener time and listener delivery in a minimized WebView2 window (7.1).
- **Fallback F2:** whether `Google.Cloud.Firestore` accepts a Firebase ID token as its credential (9.3).
- **Firestore region and prices:** the database's location and its read/write prices.
- **Identity Platform:** if the project uses it, every guest who signs in counts as a monthly active user (50 k free).
- **Per-order counts** in section 10.1 are estimates from reading the code. Confirm them with the counters in 6.5.
- **Cold-start time** of the API on App Hosting.

---

## Appendix A. Contract changes

| Kind | Change | Phase |
| --- | --- | --- |
| Auth | Custom claims `shopId`, `shopUserId`, `role` on shop users; local `verifyIdToken` | 1 |
| Response | `/api/auth/login` and `/api/auth/refresh` add `firebaseCustomToken` | 1 |
| Response | `POST /api/v1/public/shops/{slug}/session` adds `firebaseToken` (uid = `printUserId`) | 1 |
| Fields | Order: `lifecycle` gains `printingAt`, `rejectedAt`, `cancelledAt`, `paidAt`; new `completedDocumentIds`, `searchKeys`; device: `lastActiveAt` | 1 |
| Collection | New `orderTracking/{orderId}`: the customer-safe tracking copy | 1 |
| Removed | Order `statusHistory` subcollection; job `PRINTING` state; claim, report and transition idempotency documents | 1 |
| Endpoint | `POST /api/v1/shops/{shopId}/agents/{agentId}/jobs/claim` | 2 |
| Endpoint | `POST /api/v1/shops/{shopId}/agents/{agentId}/jobs/report` | 2 |
| Pipe | UI → agent: `cloud.session`, `cloud.clear`, `jobs.available { jobs }`. Agent → UI: `cloud.tokenRequired`, `cloud.state` | 2 |
| Behaviour | `confirmOnlinePayment` no longer auto-accepts; the desktop does. `accept` routes to the accepting PC first. | 2 |
| Removed | `POST /devices/heartbeat`, `GET .../agents/{agentId}/jobs`, `GET .../orders/stream`, `GET .../jobs/{jobId}/document`, `PATCH .../jobs/{jobId}`, `POST .../documents/{docId}/shred`, agent API key | 2 |
| Removed | Guest tracking poll | 3 |

## Appendix B. Firestore security rules (draft)

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function shopMember(shopId) {
      return request.auth != null && request.auth.token.shopId == shopId;
    }

    match /shops/{shopId}/orders/{orderId} {
      allow get, list: if shopMember(shopId);
    }

    // Customer-safe copy of a guest order. Guests sign in with uid = printUserId.
    match /orderTracking/{orderId} {
      allow get: if request.auth != null
        && resource.data.printUserId == request.auth.uid;
    }

    // Collection-group queries must filter on shopId, or Firestore rejects them.
    match /{path=**}/printJobs/{jobId} {
      allow read: if request.auth != null
        && resource.data.shopId == request.auth.token.shopId;
    }

    // Everything else, and every write, is server-only (the Admin SDK bypasses rules).
  }
}
```

No `get()` or `exists()` calls, so rules cost no reads.

## Appendix C. Firestore indexes

| Collection | Scope | Fields | Used by |
| --- | --- | --- | --- |
| `printJobs` | Collection group | `shopId` ASC, `status` ASC | Desktop jobs listener |
| `printJobs` | Collection group | `shopId` ASC, `agentId` ASC, `status` ASC, `createdAt` ASC | Claim without a job list |
| `orders` | Collection | `status` ASC, `createdAt` DESC | History filtered by status |
| `orders` | Collection | `searchKeys` ARRAY_CONTAINS, `createdAt` DESC | Search |

The live board's `status in [...]` query on one collection uses the automatic single-field index.

## Appendix D. Settings

| Setting | Value | Owner |
| --- | --- | --- |
| Firestore local cache | On (`persistentLocalCache`) | Desktop, web app |
| Live board statuses | SUBMITTED, SHOP_ACCEPTED, PRINTING, READY | Desktop |
| Jobs listener statuses | QUEUED, DISPATCHING, FAILED | Desktop |
| Claim batch size | Up to 10 jobs | Agent → API |
| Report retry | 1 s doubling to 5 min; network, 429 and 5xx only; 404/409 are final | Agent |
| `lastActiveAt` write | At most every 10 minutes, only on existing requests | API |
| "Shop hasn't confirmed" warning | 10 minutes in `SUBMITTED` | Web app |
| Shop config cache | 60 s per instance | API |
| Deactivation delay | ≤1 h (ID token lifetime); immediate on sensitive routes | Firebase |
| Rate limit | 30 requests/min per user, agent or guest, per instance | API |
| `minInstances` | 0 after Phase 2 | App Hosting |

## Appendix E. Sources

- [Firestore pricing and listener billing](https://firebase.google.com/docs/firestore/pricing)
- [App Hosting costs and no-cost limits](https://firebase.google.com/docs/app-hosting/costs)
- [App Hosting request timeout (product comparison)](https://firebase.google.com/docs/app-hosting/product-comparison)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud Run: streaming connections keep an instance active](https://docs.cloud.google.com/run/docs/triggering/websockets)
- [Firebase pricing (Realtime Database limits)](https://firebase.google.com/pricing)
- [Tauri 2.3 background throttling option (WebKit only)](https://v2.tauri.app/release/tauri-runtime/v2.4.0/)

## Related docs

- [`PRINT_SHOP_DESKTOP.md`](./PRINT_SHOP_DESKTOP.md): desktop architecture.
- [`CtrlP_Print_Shop_Desktop_MVP_Progress.md`](../developer-requirement/desktop-app/CtrlP_Print_Shop_Desktop_MVP_Progress.md): PRD progress.
- [`Order_to_Print_Execution_Runbook.md`](../developer-requirement/desktop-app/Order_to_Print_Execution_Runbook.md): order-to-print flow.
- [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md): App Hosting limits and run settings.
- [`apps/server/docs/print-user.md`](../../apps/server/docs/print-user.md): guest upload and checkout API.
