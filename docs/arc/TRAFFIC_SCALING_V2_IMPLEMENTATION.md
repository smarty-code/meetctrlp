# Traffic scaling v2: implementation plan

> **Status:** Final, revision 3, 15 Oct 2026. **Approved for implementation.** Phases 1–3 are written and committed on `fix/upload`; **nothing is deployed**. What's left is ops setup, staging runs and field checks (section 13).
> **Hosting change, 16 Oct 2026:** the API (`apps/server`) deploys to **Vercel**, not App Hosting; the customer web app stays on App Hosting. The design holds: Vercel Functions also freeze after the response, so rings are still awaited first. What changed: the daily clean-up runs from Vercel Cron (`apps/server/vercel.json`, `CRON_SECRET`) instead of Cloud Scheduler, and because Vercel overwrites `X-Forwarded-For`, the web app's proxy signs the visitor's IP with `CTRLP_PROXY_SECRET`. `minInstances` applies only to the web app. Steps: [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md).
> **Revision 3:** the doorbell spike passed (3.2). This revision records its results and folds in what it found: a new polling-fallback rule and a 65 s watchdog (10.3), ring timeouts treated as "unknown" (6.9), and no second token refresh on `auth_revoked` (10.2). It also fixes problems found by re-reading the plan against the code; see the revision 3 rows in section 16. Field checks on shop networks are still open. They run alongside Phase 1 as P0-03 and must pass before the agent reaches shops, but they don't block coding.
> **Revision 2:** the minimized-window test failed. A minimized WebView2 window doesn't deliver Firestore listener updates reliably. Everything time-critical now runs in the agent, which listens to a Realtime Database "doorbell" over its documented REST stream. The desktop window has no Firebase SDK.
> **Guides:** [developer guide](./traffic-scaling-v2/DEVELOPER_GUIDE.md) and [testing guide](./traffic-scaling-v2/TESTING_GUIDE.md).
> **Design:** [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](./DESKTOP_TRAFFIC_SCALING_PLAN.md) (version 2.1) explains *why*. This document covers *what changes where, in what order, and how we know it works*.
> **Components:** `apps/server`, `apps/print-shop` (Tauri UI and Rust bridge), `apps/print-agent` (C#), `apps/printUserWebapp`, `packages/firebase`, `packages/schemas`, `packages/types`, Firebase project config.
> **Baseline:** current `main`. File and line references were taken on 15 Oct 2026 and will drift.

---

## Before you start

**Settled.** The design and the defaults in design doc section 14 are accepted. The doorbell spike passed on the dev PC (3.2). Start with Phase 1 (section 13).

**Still open, and running in parallel:**

- **P0-03, shop-network field checks.** Shop broadband, mobile hotspot, a PC with antivirus HTTPS scanning, a 40-minute cut, and sleep/resume, plus the bandwidth figure from the Firebase console. These must pass before the new agent goes to shops. If a network buffers the stream, the design doesn't change; that shop runs on the polling fallback (10.3).
- **P0-04, spike clean-up.** The spike's test user and rules are still on project `meetctrlp`.

These parts are expensive to change once Phase 2 starts. Read them before writing code:

1. **The doorbell (sections 3, 6.9, 10.3).** Spike results and the reconnect rules that came out of them.
2. **Auth (section 5):**
   - the agent owns the PC's Firebase login and refreshes ID tokens with Google's Secure Token API;
   - the desktop window asks the agent for a token;
   - the server trusts custom claims.
3. **Data model (section 4):**
   - `statusHistory` is dropped and the `lifecycle` map extended;
   - new `orderTracking` collection and `completedDocumentIds`;
   - every write stamps `updatedAt` with the server timestamp;
   - new Realtime Database `/doorbell/{shopId}`.
4. **Contracts (section 6):** `sync`, `report`, `board?since=`, history and search; the ring rules; deleted routes.
5. **Auto-accept moves into the agent's `sync` (6.3).** Paid orders wait while no PC is running.
6. **Work breakdown and estimates (section 13).**

Things found in the code that should be fixed regardless are in section 16.

---

## Contents

1. [Architecture](#1-architecture)
2. [Component change map](#2-component-change-map)
3. [Spikes](#3-spikes)
4. [Data model](#4-data-model)
5. [Authentication](#5-authentication)
6. [Server](#6-server)
7. [Rules, indexes and project config](#7-rules-indexes-and-project-config)
8. [Desktop UI (`apps/print-shop`)](#8-desktop-ui-appsprint-shop)
9. [Pipe protocol and Rust bridge](#9-pipe-protocol-and-rust-bridge)
10. [Print agent (`apps/print-agent`)](#10-print-agent-appsprint-agent)
11. [Customer web app (`apps/printUserWebapp`)](#11-customer-web-app-appsprintuserwebapp)
12. [Observability and cost checks](#12-observability-and-cost-checks)
13. [Work breakdown](#13-work-breakdown)
14. [Test plan](#14-test-plan)
15. [Sequences](#15-sequences)
16. [Found along the way](#16-found-along-the-way)
17. [Docs to update](#17-docs-to-update)
18. [Out of scope](#18-out-of-scope)

---

## 1. Architecture

```text
 Customer web app ─┐                              Firestore
 Desktop UI ───────┼──▶ API on Cloud Run ───────▶  ├─ shop data (server-only)
 Print agent ──────┘    (stateless, minInstances 0) └─ orderTracking/{orderId} ──▶ customer tracking listener
                             │
                             │ after commit: ring = HTTPS PATCH with server timestamps
                             ▼
                 Realtime Database  /doorbell/{shopId} = { boardAt, workAt, last }
                             │ REST stream (text/event-stream, ?auth=<ID token>), one per shop PC
                             ▼
                 Print agent (Windows process; not throttled; starts and stops with the desktop app)
                   ├─ token manager ── Secure Token API (Google) ── refresh token in Credential Manager
                   ├─ workAt changed ─▶ POST .../agents/{agentId}/sync ─▶ accepted orders + claimed jobs + URLs
                   ├─ download (Railway), print, POST .../agents/{agentId}/jobs/report
                   ├─ boardAt changed ─▶ pipe board.changed ─▶ Desktop UI (if visible): GET .../board?since=
                   └─ last = new order ─▶ pipe orders.attention ─▶ Rust: native notification + taskbar flash
```

**Rules that hold everywhere**

- **No timers through our server.** No client sends anything on a timer through the API. The agent's only timers are its token refresh (with Google) and the stream watchdog.
- **Only the agent does time-critical work.** The desktop window only displays; it can be frozen while minimized.
- **Shop data is read and written only by the server.** Clients read Firestore only for the customer tracking copy.
- **The doorbell carries timestamps, never order data.** The agent and UI always fetch data from the API.
- **The agent acts on state, not on events.** `sync` looks for paid orders and queued jobs as they are now, so a missed or merged ring can't lose work.

---

## 2. Component change map

| Component | Add | Change | Remove |
| --- | --- | --- | --- |
| **Firebase project** | `firebase.json`, `.firebaserc`; Realtime Database instance (`asia-southeast1`); Firestore and Realtime Database rules; indexes; customer web app registration; budget alerts | — | Rule and index drafts in `packages/firebase/docs/` (moved, rewritten) |
| **`packages/firebase`** | `firestore.rules`, `database.rules.json`, `firestore.indexes.json`, rules tests, `createCustomToken` and `getServiceAccessToken` helpers | — | — |
| **`packages/schemas` / `types`** | Schemas for `sync`, `report`, `board`, history and search; `ShopPrincipal`; pipe message shapes | Session response gets `firebaseToken` | Heartbeat schema; per-job PATCH and claim schemas |
| **Server: auth** | `ShopPrincipal`, local `verifyIdToken` | `requireShopUser` → `requireShopPrincipal`; registration fails if claims can't be set and returns a token with claims; logout revokes only with `allDevices` | Per-request `lookupIdToken` and `authLookups` reads |
| **Server: realtime (new module)** | `ringShop` (doorbell ring helper) | Called after commits in order, job and payment paths | — |
| **Server: orders** | `orderTracking` copy, `searchKeys`, `completedDocumentIds`, single order-write helper, history and search endpoints | Lifecycle times; transitions idempotent by status; payment confirm no longer auto-accepts and is idempotent by state; mock payment gated by env; accept takes `agentId` and doesn't re-queue on replay | `statusHistory`, transition idempotency docs, SSE stream, the old full `GET /orders` |
| **Server: print jobs** | `syncAgent` (auto-accept, claim, re-deliver stuck jobs), `reportAgentJobs`, `board` endpoint, storage delete on COMPLETED | Routing prefers the caller's PC; retry clears the lease, re-routes properly, and can rescue QUEUED or stuck DISPATCHING jobs; one active job per document | Agent jobs list and fallback; per-job claim, PATCH, document and shred routes; job `PRINTING` |
| **Server: devices** | `/devices/offline` marks this PC's printers OFFLINE | `registerShopDevice` issues no credential | Heartbeat route, `markStaleAgentsOffline`, `requireAgentCredential`, `apiKeyHash` |
| **Server: print-user** | Signed session cookie; `firebaseToken` on session start | Read the session once per request; shop config cached 60 s | Per-minute session touch writes |
| **Desktop UI** | `board.ts` (initial and delta), `order-history.ts`, visibility handling | API token comes from the agent; boot, login and sign-out; Orders screen data source; connection badge | Heartbeat, SSE client, full order list, token state, agent-credential hand-off |
| **Rust bridge** | `notify()` (one-way frame), `agent_notify` and `agent_get_id_token` commands, native notifications (`tauri-plugin-notification`), `agent:ready` event | Sidecar gets `--parent-pid`, so the agent exits with the app | `set_agent_cloud_credential` |
| **Print agent** | `FirebaseTokenManager`, `DoorbellClient` (SSE, watchdog, polling fallback), `AgentSyncService`, `ReportOutbox`, handlers for `cloud.*` and `sync.request` | SQLite gains report-state and shop columns; separate download client; de-duplication by job and lease; marks the PC offline on shutdown | Poll loop, per-job routes, agent API key and its Credential Manager entry |
| **Customer web app** | Lazy Firebase module, tracking listener, "shop hasn't confirmed" state | Session and cart reuse between pages; one quote | 6 s tracking poll, dead tracking and payment code |
| **Hosting** | `FIREBASE_DATABASE_URL`, `PRINT_USER_COOKIE_SECRET` | `minInstances: 0` | — |

---

## 3. Spikes

### 3.1 Minimized-window test: failed (recorded)

Firestore listener updates aren't delivered reliably to a minimized WebView2 window. The design was revised so that:

- the web view does nothing time-critical;
- the agent holds the realtime connection;
- native notifications come from the Rust side.

### 3.2 Doorbell spike (P0-02): passed, 15 Oct 2026

**Verdict: go.** On the dev PC's network the stream delivered every ring that reached the database, fast and cheaply, and it survived token expiry. The parts that need real shops are P0-03 (3.3).

**What was built** (in `spikes/doorbell/`, not shipped; see its `README.md`):

- **Listener:** a C# .NET 8 console app standing in for `DoorbellClient` (10.3). It uses the Secure Token API, the SSE stream, a watchdog, backoff and the polling fallback, and logs JSONL.
- **Ringer:** a Node script that rings the way `ringShop` (6.9) will, with a PATCH with server timestamps, a 2 s timeout and one retry.
- **Analyzer:** a script that turns both logs into the table below.
- **Shop kit:** a single `.exe` plus launcher for the field checks.

It ran against project `meetctrlp` with the Realtime Database instance `meetctrlp-default-rtdb` (`asia-southeast1`), the rules from 7.2, and a test user with claim `shopId: "spike"`.

**Results** (72-minute run on the dev PC, Windows 11, home broadband; report in `spikes/doorbell/logs/user-72min/report.md`):

| Item | Pass criterion | Result |
| --- | --- | --- |
| Rules | Own shop readable; other shop, no token, root, and writes denied | **Pass.** All 5 checks. |
| Ring → event latency | p95 under 500 ms | **Pass.** Database commit → event: p50 54 ms, p95 77 ms, worst 201 ms, over 53 live rings (clock error ±46 ms). |
| No missed values | The last value always arrives | **Pass.** 53 live, 4 caught up by the first value after a reconnect or poll, 3 never written (the ringer's own upload failed). Nothing that reached the database was lost. |
| Keep-alive interval | Recorded | **30 s**, exactly, over 80 keep-alives (max 30.2 s). Sets the watchdog to **65 s** (10.3). |
| Bandwidth | 25 KB or less per connection-hour | **Pass.** Idle cost (keep-alives plus one TLS handshake an hour) is about **6.4 KB/h**; each ring adds about 160 B per PC. 1,000 PCs × 12 h/day comes to about **2.3 GB/month** (10 GB free). Body bytes on a second run were 12.7 KB/h with about 50 test rings an hour. **Still to confirm** on the console's usage page (P0-03). |
| Token expiry | `auth_revoked` at about 60 min; back within 5 s; first `put` is the latest value | **Pass.** `auth_revoked` at exactly 60.0 min. Refresh plus reconnect took 1.3 s, and the first value was the latest. |
| 307 redirect | Followed | **Not seen** on the real database. Following a 307 with `?auth=` intact was shown against the mock server. |
| Short network drop | Reconnect within 30 s of the network returning | **Found a bug in the plan's fallback rule** (finding 1 below). After the fix, a 40 s outage against the mock server reconnected within 4 s of the server returning. |
| Long cut (40 min), sleep and resume | Reconnect within 30 s | **Open:** P0-03. |
| Shop networks: broadband, mobile hotspot, antivirus HTTPS scanning, proxy | Events arrive unbuffered | **Open:** P0-03. The dev PC's broadband passed. |

**Second run (78 minutes, same PC):** every testable row passed again. Commit → event p50 73 ms, p95 98 ms, worst 239 ms; 64 of 66 rings live, the other 2 never reached the database; token expiry at 60.0 minutes with a reconnect in 0.8 s; about 22 KB/h while ringing about 50 times an hour. The database also closed the stream on its own twice; the listener reconnected in 3.2 s and 0.3 s, as the reconnect rule expects.

**What the spike changed in this plan:**

1. **Polling fallback rule (10.3).** The draft rule, "5 failed connects within 10 minutes", is triggered by any Wi-Fi drop longer than about 30 s, because backoff starts at 1 s. When the network came back 33 s later, the listener stayed on 60 s polling for 30 minutes. Polling helps only when the server is reachable but the stream doesn't work, which is what buffering looks like. When the PC is offline, polling fails too. New rule: only *broken* streams count, and 3 in a row switch to polling. *Unreachable* attempts (DNS, connect, token refresh network errors) never count.
2. **Watchdog: 65 s** (2 × the measured 30 s keep-alive, plus 5 s slack).
3. **A ring timeout doesn't mean the ring failed (6.9).** Several PATCHes timed out at 2 s on the client but had already landed, and the listener received them. Log a timeout as `ring_unknown`, not `ring_failed`. Retrying is harmless, because rings are timestamps.
4. **Reuse one connection for rings (6.9).** New TLS connections took 3–10 s on a bad path. Production rings come from Cloud Run over Google's network, so this matters less there, but it costs nothing.
5. **No second refresh on `auth_revoked` (10.2, 10.3).** With the proactive refresh at 55 minutes, the cached token is already fresh when the stream is revoked at 60 minutes. Reconnect with it.

**Polling cost, for reference:** each poll returned about 140 B of body. Headers dominate, so a PC on the fallback uses an estimated 30–60 KB/h (not measured on the console).

### 3.3 Field checks (P0-03): open, run alongside Phase 1

Use the shop kit and steps 4.3–4.5 and 5 of `spikes/doorbell/README.md`. Run the ringer on the dev PC.

| Check | Pass |
| --- | --- |
| 2 or 3 real shop networks, including at least one PC with third-party antivirus HTTPS scanning (Quick Heal, K7, Kaspersky, ESET, Avast), and a mobile hotspot | Events arrive unbuffered; p95 under 500 ms |
| 40-minute network cut on a PC that isn't the ringer | Reconnect within 30 s of the network returning; the first value is the latest |
| Windows sleep and resume (5 and 40 minutes) | Reconnect within 30 s of waking |
| Firebase console → Realtime Database → Usage → Downloads, over a run with one known listener | 25 KB or less per connection-hour |

**Outcomes:**

- **All pass:** ship the agent to shops when Phase 2 is done.
- **Some networks buffer or block:** no design change. Record which ones; those shops run on the polling fallback, with jobs up to 60 s late. Check E11 on one of them.
- **Unusable on most shop networks:** stop before P2-03 and revisit the design.

---

## 4. Data model

Paths as today unless marked **new**.

### 4.1 `shops/{shopId}/orders/{orderId}`

| Field | Change | Notes |
| --- | --- | --- |
| `status` | unchanged values | SUBMITTED, SHOP_ACCEPTED, PRINTING, READY, COMPLETED, REJECTED, CANCELLED |
| `lifecycle` | **extended** | Existing: `submittedAt`, `acceptedAt`, `acceptedByUserId`, `readyAt`, `completedAt`, `completedByUserId`. Add: `printingAt`, `rejectedAt`, `cancelledAt`, `paidAt`. Replaces `statusHistory`. |
| `updatedAt` | **server timestamp, always** | `FieldValue.serverTimestamp()` on create and on every write. Every writer already does this today; `applyOrderChange` keeps it so. `board?since=` depends on it. |
| `createdAt` | unchanged | Already a server `Timestamp` (`order.service.ts` 372, 554), so range queries work. The exception, `documents[].shreddedAt`, is an ISO string; leave it. |
| `completedDocumentIds` | **new**, `string[]` | Added with `arrayUnion` by reports. READY when it covers every `documents[].id`. |
| `searchKeys` | **new**, `string[]` | Lowercased: order number, pickup code, phone digits, filename words of 3 or more letters. At most about 40. |
| `statusHistory/*` | **removed** | Writes at `order.service.ts` 375, 557, 626, 819; reads in `readHistory` (240). `getShopOrder` reads the whole subcollection on every call today, including inside dispatch and queueing, so dropping it also removes those reads. |

**Single writer.** Every order write goes through `applyOrderChange(transaction, orderRef, current, change)`. It:

1. checks the transition;
2. sets `status`, the matching `lifecycle.*At`, and `updatedAt` (server timestamp);
3. writes the tracking copy (4.2) when a customer-visible field changed;
4. skips no-op writes;
5. returns a `ring` hint (6.9).

Writers to route through it: `transitionOrder`, `acceptShopOrder`, `rejectShopOrder`, `markShopOrderPrinting`, `markShopOrderReady`, `completeShopOrder`, `cancelShopOrder`, `recordCashPayment`, `confirmOnlinePayment`, `createPdfOrder` (`document.service.ts` 149), `createSinglePagePrintOrder` (`order.service.ts` 876), and the sync and report paths. The order writes in `claimPrintJob`, `updatePrintJob` and `confirmDocumentShredded` go away with those functions (6.3).

### 4.2 `orderTracking/{orderId}` (new, Firestore)

A customer-safe copy, the only order data a guest can read. Rules can't hide fields, so guests never read the order itself; it holds staff IDs, payment references and storage keys.

| Field | Source |
| --- | --- |
| `orderId`, `shopId`, `printUserId`, `orderNumber`, `pickupCode`, `status` | order |
| `payment` | `{ method, status }` only |
| `totalPaise` | `amounts.total` |
| `items[]` | `{ name, pageCount, billablePages, copies, colorMode, paperSize, totalPaise, mimeType }` |
| `rejectionReason` | `rejection.reason` |
| `times` | `{ submittedAt, paidAt, acceptedAt, printingAt, readyAt, completedAt, rejectedAt, cancelledAt }` |
| `updatedAt` | — |

- **Written:** in the same transaction as guest-order changes (about 6 per order).
- **Not written:** for shop-created orders.
- **Deleted:** 30 days after a terminal status, by the daily job (6.10).

### 4.3 `shops/{shopId}/orders/{orderId}/printJobs/{jobId}`

| Field | Change |
| --- | --- |
| `status` | **`PRINTING` removed.** QUEUED → DISPATCHING → COMPLETED / FAILED / CANCELLED. Retry (6.3) moves a job back to QUEUED from FAILED, from QUEUED (to re-route it), or from DISPATCHING when it has been stuck for more than 15 minutes. |
| `leaseId`, `claimedAt` | Set by claim (in `sync`), **cleared** by retry. `claimedAt` is also refreshed when `sync` re-delivers a stuck job (6.3). |
| `updatedAt` | **Server timestamp, always.** Used by `board?since=` for jobs. |
| `pagesPrinted`, `spoolerJobId`, `errorCode`, `errorMessage`, `completedAt` | Set by the final report |

Idempotency documents for claim, update and retry are removed: the lease and the status precondition make them idempotent. Dispatch keeps its key.

**One active job per document.** Today `queueIncomingOrder` passes a random key for each document, and the accept route queues again on a replayed accept, so duplicate jobs for the same document happen (`print-job.service.ts` 893–929). After this change:

- `queueIncomingOrder` uses the key `queue:{orderId}:{documentId}`;
- `dispatchPrintJob` returns 409 `JOB_ACTIVE` if the document already has a QUEUED or DISPATCHING job, and 409 `DOCUMENT_SHREDDED` if its file was deleted.

### 4.4 `shops/{shopId}/agents/{agentId}`

- `apiKeyHash` is removed (no credential).
- `status` and `lastSeenAt` are replaced by `lastActiveAt` (6.7).

### 4.5 `shops/{shopId}/printers/{printerId}`

Unchanged fields. `/devices/offline` sets `status: OFFLINE` for this agent's printers. Routing prefers the caller's agent.

### 4.6 `printUsers/{printUserId}`

- No touch writes. The signed cookie carries expiry.
- `expiresAt` is still written on create and on cart changes.

### 4.7 Shop users (Firebase Auth)

Claims `{ shopId, shopUserId, role }` are set at registration (`auth.service.ts` 206–214). **Make that required:** roll back registration if setting claims fails.

**Return a token that carries the claims.** The ID token from sign-up is minted before the claims are set (`auth.service.ts` 189, then 207), so under claims-only auth the first session would get `CLAIMS_MISSING`. After setting claims, call `refreshIdToken(refreshToken)` (`packages/firebase/src/auth-rest.ts` 186) and return the new tokens.

There are no staff-management routes yet. When they're built, they must set claims and, on deactivation, disable the user and revoke refresh tokens.

### 4.8 `/doorbell/{shopId}` (new, Realtime Database)

| Field | Type | Meaning |
| --- | --- | --- |
| `boardAt` | number (ms, server timestamp) | Something on the shop's board changed |
| `workAt` | number (ms, server timestamp) | There may be work for agents: a paid order to accept, or jobs queued |
| `last` | `{ type, orderId, orderNumber }` | The latest event. `type` is one of `order_submitted`, `order_paid`, `jobs_queued`, `order_updated`. Used only for notifications. |

- **Who writes it:** only the server, with a service-account token.
- **Size:** under 300 bytes. No other data lives in Realtime Database.

---

## 5. Authentication

### 5.1 Shop principals on the API

| Today | After |
| --- | --- |
| `requireShopUser(idToken)`: `lookupIdToken` (an HTTPS call to Google), then 2 reads, returning `AuthSessionUser` | `requireShopPrincipal(request)`: `verifyIdToken` locally, returning `ShopPrincipal { uid, shopId, shopUserId, role }` from claims. 0 network calls, 0 reads. |

- **Missing claims** → 401 `CLAIMS_MISSING`. No fallback; there are no existing users.
- **Revocation checks** (`verifyIdToken(token, true)`) on `logout` and future staff-management routes.
- **Route audit:** there are 55 `route.ts` files under `apps/server/app/api`: 37 use shop auth, 8 are guest routes, and 5 also accept the agent-key header. Produce a table of shop route → fields used and attach it to the PR. Routes that need `name`, `email` or `phone` read the user document; `/api/auth/me` returns the full user.
- **Sign-out no longer revokes by default.** Today `logoutShopUser` calls `revokeRefreshTokens` (`auth.service.ts` 261), which signs that user out on **every** PC. A shop often uses one login on several PCs, and the agent now holds a long-lived refresh token, so signing out on PC A would log PC B out within the hour and stop it printing. New body: `POST /api/auth/logout { allDevices?: boolean }`. Revoke only when `allDevices` is true. The desktop's sign-out sends false. Staff deactivation still revokes (4.7).

### 5.2 The PC's login is owned by the agent

The refresh token already lives in Windows Credential Manager (`Ctrlp.PrintShop/refreshToken`), written through the agent. The agent now also **uses** it.

**Agent token manager:**

- **Endpoint:** `POST https://securetoken.googleapis.com/v1/token?key=<firebaseApiKey>` with form `grant_type=refresh_token&refresh_token=…`. The response has `id_token`, `refresh_token`, `expires_in` and `user_id`. This is the documented Firebase Auth REST call; our server already uses it in `refreshIdToken`.
- **When it refreshes:** at 55 of 60 minutes, and on a 401 from our API (once). Only one refresh runs at a time. An `auth_revoked` stream event refreshes only if the cached token has less than 5 minutes left; normally the 55-minute refresh has already happened, and the stream just reconnects with the cached token.
- **Rotation:** if Google returns a different `refresh_token`, store it.
- **Failure:** the agent reports `cloud.state { token: "invalid" }`, and the UI shows the login screen.

**Desktop window:**

- Gets its bearer token from the agent with the pipe request `cloud.getIdToken`. It never holds tokens itself.
- On a 401 from the API, it asks again with `forceRefresh: true`, retries once, then shows the login screen.

**Flows:**

- **Login:**
  1. `POST /api/auth/login` (unchanged response: `user`, `tokens`).
  2. `secrets.setRefreshToken` (existing).
  3. Register the device.
  4. `cloud.session { shopId, agentId, idToken, expiresAt }`. The login's ID token seeds the agent, so it doesn't refresh straight away.
- **Boot:**
  1. Wait for the agent, then `cloud.configure`.
  2. `cloud.getIdToken`. If it returns `signedIn: false`, show the login screen.
  3. Otherwise `GET /api/auth/me`, register the device, and send `cloud.session`.
- **Sign-out** (the same order as 8.3):
  1. `POST /devices/offline` (marks this PC's printers OFFLINE; needs the token, so it goes first).
  2. `POST /api/auth/logout { allDevices: false }`: no revoke (5.1).
  3. `cloud.clear`: the agent stops the stream, forgets the token, and holds pending reports.
  4. `secrets.clearRefreshToken`.
- **App exit:** the agent exits with the desktop app (10.1) and calls `POST /devices/offline` on its way out.
- **`POST /api/auth/refresh`** stays on the server for other clients; the desktop no longer calls it.

**API key:** the desktop needs only the Firebase Web API key and the database URL; it doesn't need a registered Firebase web app. The agent uses the key only for the Token Service API (the doorbell authenticates with `?auth=<idToken>`), so restrict the desktop key to the Token Service API.

### 5.3 Agent calls to the API

- The agent sends `Authorization: Bearer <idToken>`. The 5 agent routes already accept a shop Bearer as an alternative to the agent key, so this mode works today.
- Inside each transaction, the server checks `principal.shopId == job.shopId` (or the order's shop) and `job.agentId == path agentId`.
- Removed: `requireAgentCredential`, the headers `x-ctrlp-agent-key` / `x-ctrlp-agent-id`, `apiKeyHash`, `secrets.setAgentCloudCredential`, and the Credential Manager entry `Ctrlp.PrintShop/agentCloud`.

### 5.4 Customers

- `POST /api/v1/public/shops/{slug}/session` also returns `firebaseToken = createCustomToken(printUserId)`.
- The tracking page signs in with it and reads `orderTracking/{orderId}` where `printUserId == auth.uid`. No custom claims are needed.
- **Cost check before P3-01:** if the project has been upgraded to Identity Platform, each guest who signs in counts as a monthly active user (50 k free, then about $0.0046–0.0055 each). The repo shows no sign of Identity Platform: no tenants, MFA, blocking functions or v2 admin calls, and phone login is password-based. Confirm in the console (Authentication → Settings). Sign-in happens only on the tracking page, so MAU is roughly the number of orders: free at 1,000 a day, and about $1,200/month at 10,000 a day if Identity Platform is on. With legacy Firebase Auth, custom-token sign-in is free.

---

## 6. Server

Paths under `apps/server/` unless noted.

### 6.1 Auth module

**Where:**

- `src/modules/auth/auth.service.ts`
- `require-request.ts`
- `src/modules/orders/order-http.ts` (`runShopOrder`)
- `src/modules/shops/shop-route.ts` (`withOwnShop`)
- `packages/firebase/src/auth.ts`
- `packages/types/src/auth.ts`

**Tasks:**

- `requireShopPrincipal`; rewire `readAuthorizedShopUser`, `runShopOrder` and `withOwnShop`, keeping the `shopId` match.
- Registration: claims required, and the returned tokens refreshed so they carry the claims (4.7).
- `logoutShopUser`: take the uid from the verified token (it already does, through `lookupIdToken`); revoke only with `allDevices: true` (5.1).
- Export `createCustomToken` from `packages/firebase` (used for guests).

### 6.2 Orders module

**Where:** `src/modules/orders/order.service.ts`, routes under `app/api/v1/shops/[shopId]/orders/**`.

**Tasks:**

- `applyOrderChange` (4.1). Move every writer onto it.
- `transitionOrder`: no idempotency documents. A replay to the current status returns the order with no write; any other wrong status returns 409.
- Delete `readHistory` and the `history` parameter of `toOrderDto`.
- `createPrintUserOrder`:
  - write `searchKeys`, `completedDocumentIds: []`, a server-timestamp `updatedAt`, and the tracking copy;
  - keep the submit idempotency key;
  - ring `order_submitted` (board).
- `createShopOrder`: the same fields (no tracking copy); ring `order_submitted`.
- `confirmOnlinePayment`:
  - **remove auto-accept** (line 802; the shop config is read outside the transaction there today);
  - set `payment.status`, `payment.reference`, `lifecycle.paidAt`;
  - **idempotent by state:** if the payment is already PAID, return the order with no write and no ring. Today a new idempotency key rewrites `payment.reference` and `confirmedAt`;
  - callers (the webhook at `internal/payments/.../confirmed/route.ts` 32–35, and `mockConfirmGuestPayment` at `print-user.service.ts` 449–458) **remove `queueIncomingOrder`** and ring `order_paid` (work + board).
- **Gate the mock payment route now (P1-00, security).** `POST /public/session/orders/{orderId}/payments/mock-confirm` has no environment check, so in production any guest can mark their own ONLINE order PAID, which auto-accepts and prints it. Return 404 unless `ALLOW_MOCK_PAYMENTS=1`, set only in local and staging environments.
- **Delete:**
  - `subscribeShopOrders` and `orders/stream/route.ts`;
  - the GET handler in `orders/route.ts`, replaced by history (6.4); keep POST;
  - `listShopOrders`.

### 6.3 Print-jobs module: `sync` and `report`

**Where:** `src/modules/printing/print-job.service.ts`, new routes under `app/api/v1/shops/[shopId]/agents/[agentId]/`.

**`syncAgent(principal, agentId)`**, route `POST .../agents/{agentId}/sync`:

1. **Auto-accept.** Only if shop config `autoAcceptPaidOnline` (cached 60 s).
   - Query `orders` where `status == SUBMITTED`, `payment.status == PAID`, limit 10.
   - For each, one transaction: `applyOrderChange` to SHOP_ACCEPTED, with actor `agent:{agentId}`.
   - Then, if `autoDispatchAcceptedOrders`: `queueIncomingOrder(order, { preferAgentId: agentId })`.
   - A transaction that finds the order already accepted (another PC won) skips it.
2. **Claim.** Query collection group `printJobs` where `shopId`, `agentId == agentId`, `status == QUEUED`, ordered by `createdAt`, limit 10.
   - One transaction: set each still-QUEUED job to DISPATCHING with a new `leaseId` and `claimedAt`.
   - Orders still SHOP_ACCEPTED → PRINTING (`applyOrderChange`).
3. **Re-deliver stuck jobs.** Query collection group `printJobs` where `shopId`, `agentId == agentId`, `status == DISPATCHING`, `claimedAt < now − 15 min`, limit 10. Return them with the **same** `leaseId` and a fresh URL, and set `claimedAt` to now.
   - **Why:** if the agent dies between the claim response and its local `Enqueue`, it has no record of the job, and nothing today ever reclaims it. There is no lease expiry anywhere, so the job and its order would stay DISPATCHING and PRINTING forever.
   - The agent skips any job it already has locally with the same lease (10.4), so re-delivery never prints twice.
   - Costs at least 1 read per `sync`, even when empty.
4. **After commit:**
   - sign a download URL for each claimed job (`createPresignedDownloadUrl`, signed locally). Use **60 minutes**, not today's 15 (`DOWNLOAD_TTL_SECONDS = 900`, `document.service.ts` 14). The per-job document route is being deleted, so the agent can't fetch a fresh URL. Ten files downloaded one after another on a slow shop line can take longer than 15 minutes;
   - ring the board once if anything changed;
   - also ring work if step 1 queued jobs for **other** agents.
5. **Output:** `{ accepted: [orderId], claimed: [{ orderId, jobId, documentId, leaseId, resolvedSettings, printerSystemName, printerName, pagesTotal, redelivered, download: { url, sha256Hash, mimeType, pageCount, expiresIn } }], more }`. `more` is true when any query hit its limit.

**`reportAgentJobs(principal, agentId, input)`**, route `POST .../agents/{agentId}/jobs/report`:

- **Input:** `{ reports: [{ orderId, jobId, leaseId, status: COMPLETED | FAILED | CANCELLED, pagesPrinted?, spoolerJobId?, errorCode?, errorMessage? }] }`, at most 20.
- **For each report, one transaction:**
  1. Read the job and the order.
  2. If the job is already in the reported status with the same lease, it's a replay: continue to step 5.
  3. If the lease doesn't match, report `lease_mismatch`. If the job isn't DISPATCHING, report `invalid_state`.
  4. Otherwise set the final status and fields. On COMPLETED, `arrayUnion(documentId)` into `completedDocumentIds`. If that now covers every document and the order is PRINTING, `applyOrderChange` to READY.
  5. **After commit, on COMPLETED:** if no other QUEUED or DISPATCHING job in the order uses the same `documentId` (one query on the order's `printJobs`), `deleteObject(storageKey)`, then set `documents[i].shreddedAt`. If the delete fails, report `retry`. Today `confirmDocumentShredded` only sets `shreddedAt` and never deletes the object (`document.service.ts` 239–284).
- **Ring the board once per request.**
- **Output:** `{ results: [{ jobId, result: ok | retry | lease_mismatch | invalid_state | not_found }] }` with HTTP 200. HTTP 5xx only when the whole request failed.

**Change:**

- `retryPrintJob` (also the operator's way to rescue a job). Allowed from:
  - FAILED (as today);
  - QUEUED, to re-route a job whose PC is gone;
  - DISPATCHING with `claimedAt` older than 15 minutes, when the PC died and isn't coming back.

  It then:
  - clears `leaseId`, `claimedAt` and `startedAt` (today it keeps them, line 869), increments `retryCount`, and rings work;
  - with a new `printerId`: re-reads the printer and checks it exists and is enabled, then sets `agentId`, `printerName` and `printerSystemName` from it. Today only `printerId` changes (871), so the old PC claims the job and prints to the old printer;
  - leaves the old agent's late report to get `lease_mismatch`.

  A live agent refreshes `claimedAt` through re-delivery, so only a job whose PC has stopped syncing becomes rescuable. The desktop asks the operator to confirm a rescue, because a large job may still be printing.

  Today the only way out of DISPATCHING is the per-job PATCH, which no UI calls.
- `routePrintJob(…, { preferAgentId })`: among capable, enabled, ONLINE printers, prefer the agent, then default, then fewest `activeSpoolJobs`.
- `dispatchPrintJob` (manual): the guards in 4.3 (`JOB_ACTIVE`, `DOCUMENT_SHREDDED`); ring work.
- `queueIncomingOrder`: the deterministic key `queue:{orderId}:{documentId}` (4.3).
- `assertJobTransition`: no PRINTING.

**Delete:**

- `listAgentPrintJobs`, `listQueuedJobsByCollectionGroup`, `listQueuedJobsFromActiveOrders`, `claimPrintJob`, `updatePrintJob`;
- routes: `agents/[agentId]/jobs` (GET), `orders/[orderId]/jobs/[jobId]/claim`, `orders/[orderId]/jobs/[jobId]` (PATCH), `.../jobs/[jobId]/document`, `.../documents/[docId]/shred`;
- `confirmDocumentShredded`.

### 6.4 Board, history and search (new)

**`GET /api/v1/shops/{shopId}/board`** (shop principal):

- **Without `since`:** active orders (`status in [SUBMITTED, SHOP_ACCEPTED, PRINTING, READY]`) and unfinished jobs (collection group `printJobs` where `shopId ==`, `status in [QUEUED, DISPATCHING, FAILED]`).
  - Returns `{ full: true, orders, jobs, cursor }`.
- **With `since=<cursor>`:** orders where `updatedAt > since − 5 s`, and jobs (collection group) where `shopId ==` and `updatedAt > since − 5 s`, each capped at 200.
  - Returns `{ full: false, orders, jobs, cursor }`.
  - If a cap is hit, it returns the full form instead.
  - Orders that left the active set appear with their new status, so the client moves them.
- **Cursor:** the server's time at request start (ISO). The 5 s overlap covers clock skew between instances. The client removes duplicates by `(id, updatedAt)`.
- **Reads:** at least 2 per call, plus the documents returned.

**`GET /api/v1/shops/{shopId}/orders`** with `status`, `from`, `to`, `cursor`, `limit` (default 50):

- newest first by `createdAt`;
- `from`/`to` are dates in shop time (Asia/Kolkata), converted on the server;
- returns `{ orders, nextCursor }`.

**`GET /api/v1/shops/{shopId}/orders/search`** with `q`, `cursor`: `searchKeys array-contains q` (3 or more characters, lowercased), newest first, paged by 50.

**Kept:** `GET .../orders/{orderId}` and `GET .../orders/{orderId}/jobs`, for order details.

### 6.5 Accept

- **`POST .../orders/{orderId}/accept`** body: `{ agentId? }`.
  - With `autoDispatchAcceptedOrders`: `queueIncomingOrder(order, { preferAgentId })`, then ring work.
  - A replay on an already accepted order returns 200 and doesn't queue again. Today it queues a second set of jobs, because the accept route calls `queueIncomingOrder` even when `transitionOrder` returned early (accept route 20–22, `order.service.ts` 601–602).

### 6.6 Devices

- **Delete:** the heartbeat route, `recordDeviceHeartbeat`, `markStaleAgentsOffline`, `HEARTBEAT_INTERVAL_SECONDS`, and `deviceHeartbeatRequestSchema`.
- **`registerShopDevice`:** no credential issuance. Writes `{ id, shopId, hostname, osVersion, appVersion, agentVersion, registeredByUserId, lastActiveAt, updatedAt }`. Returns `{ deviceId }`.
- **`markDeviceOffline`:** also sets this agent's printers OFFLINE (one batch). Today it marks only the agent document, and nothing on the server ever sets a printer OFFLINE (`device.service.ts` 171); routing ignores agent status. Called by the desktop's sign-out and by the agent when it exits (10.1).

### 6.7 `lastActiveAt`

`touchAgentActivity` runs on `register`, `accept` (with `agentId`), `sync` and `report`. At most every 10 minutes per agent and instance; one `update` with no read; best effort.

### 6.8 Guest API (print-user)

**Signed cookie.** The value is `v1.<printUserId>.<expiresAtEpochSeconds>.<ipHash>.<hmac>`, with HMAC-SHA256 using the new secret `PRINT_USER_COOKIE_SECRET`. Today the cookie is the raw `printUserId` (`print-user-http.ts` 25), checked by reading the session document and comparing the IP on every call, so this is also a hardening step.

`requirePrintUserSession` then:

- verifies the cookie with **no read**;
- re-issues it at most once an hour (sliding expiry).

**Other tasks:**

- `completeGuestDocument`: read the session once, then the transaction.
- Remove `touchSession` and `shouldTouchSession`.
- Session start returns `firebaseToken` (5.4). Stop returning `ipAddress` and storage keys in the session DTO.
- `getShopConfig`: 60 s cache per instance, invalidated on that instance's own writes.
- Keep `GET /public/session/orders/{orderId}` as a one-shot fallback; trim its response to the tracking copy's fields.

### 6.9 Realtime module: ringing the doorbell (new)

**Where:** new `src/modules/realtime/doorbell.ts`; `packages/firebase` gets `getServiceAccessToken()`.

**`ringShop(shopId, { work, event })`:**

- **Access token:** `getServiceAccessToken()` uses the Admin app's credential (`getAccessToken()`), whose scopes include `firebase.database` and `userinfo.email`. It's cached until 5 minutes before expiry.
- **Request:** `PATCH {FIREBASE_DATABASE_URL}/doorbell/{shopId}.json` with `Authorization: Bearer <token>` and body `{ "boardAt": {".sv":"timestamp"}, "workAt"?: {".sv":"timestamp"}, "last": { "type", "orderId", "orderNumber" } }`.
- **Connection:** one module-level keep-alive connection per instance (Node's `fetch` pools by default; don't create a new agent or dispatcher per call). A cold TLS handshake cost seconds on a bad path in the spike.
- **Timeout and retry:** 2 s timeout; one retry after 200 ms. It never throws.
- **Logging the outcome** (the spike showed timed-out PATCHes that had already been applied):
  - an HTTP 2xx → nothing to log;
  - a timeout on both attempts → `ring_unknown` (shopId, event). The write may have landed;
  - an HTTP error or a refused connection on both attempts → `ring_failed` (shopId, event, status).
- **Awaited before the response is sent,** because Cloud Run takes CPU away after the response.
- **What catches up after a lost ring.** Only a later change to the doorbell value does, because the agent acts on `workAt` changes. An agent reconnect re-reads the current value, so it doesn't help if the ring never landed. The catch-ups are:
  - the shop's next work ring;
  - an agent restart (the first value after a start always syncs);
  - the desktop's stale-work nudge (8.4), when the window is visible;
  - the operator's "Sync now".

  The `ring_failed` alert (12.3) makes the case visible. Design doc decision 9 covers the option of a safety sync.
- **Local development:** the Realtime Database emulator (port 9000), with `FIREBASE_DATABASE_URL=http://127.0.0.1:9000?ns=<project>-default-rtdb`.

**Ring table** (each row after its transaction commits):

| Source | `work` | `last.type` |
| --- | --- | --- |
| `createPrintUserOrder`, `createShopOrder` | no | `order_submitted` |
| Payment confirmed (webhook, mock confirm) | yes | `order_paid` |
| Manual accept with jobs queued; manual dispatch; retry | yes | `jobs_queued` |
| `sync` | Only if jobs were queued for other agents | `jobs_queued` / `order_updated` |
| Reject, cancel, ready, complete, cash collected, report, manual `printing` | no | `order_updated` |

Shop-wide coalescing: two rings within the same request become one call.

### 6.10 Daily maintenance (Cloud Scheduler)

`POST /api/v1/internal/maintenance/daily` (shared-secret header), once a day:

1. Delete `orderTracking` documents for orders terminal for more than 30 days.
2. Delete expired `printUsers` sessions and their leftover storage objects.
3. Delete storage objects for REJECTED or CANCELLED orders older than 1 day.

### 6.11 Schemas and types

**`packages/schemas`:**

- **Add:**
  - `syncAgentResponseSchema`;
  - `reportAgentJobsRequestSchema` / `reportAgentJobsResponseSchema`;
  - `boardResponseSchema`, `orderHistoryQuerySchema`, `orderSearchQuerySchema`;
  - `acceptOrderRequestSchema` (`{ agentId? }`);
  - `logoutRequestSchema` (`{ allDevices? }`);
  - `retryPrintJobRequestSchema` gains the QUEUED and stuck-DISPATCHING cases (no shape change);
  - pipe shapes: `cloudConfigureSchema`, `cloudSessionSchema`, `cloudStateSchema`, `ordersAttentionSchema`.
- **Remove:**
  - `deviceHeartbeatRequestSchema`;
  - `updatePrintJobRequestSchema`, `claimPrintJobRequestSchema`, `claimAgentPrintJobsRequestSchema`.

**`packages/types`:** add `ShopPrincipal`.

---

## 7. Rules, indexes and project config

### 7.1 Files

| File | Purpose |
| --- | --- |
| `firebase.json` (repo root, new) | Firestore rules and indexes, Realtime Database rules, emulators: Firestore 8080, Auth 9099, Database 9000 |
| `.firebaserc` (new) | Project aliases, for example `staging` and `prod` |
| `packages/firebase/firestore.rules` (new) | 7.2. Replaces the drafts in `packages/firebase/docs/` and `docs/desktop app feature MBP/`. |
| `packages/firebase/database.rules.json` (new) | 7.2 |
| `packages/firebase/firestore.indexes.json` (new) | 7.4 |
| `packages/firebase/test/rules.test.ts` (new) | `@firebase/rules-unit-testing` against both emulators |
| root `package.json` | `firebase-tools` as a dev dependency; scripts `firebase:rules:test` and `firebase:deploy:rules` |

### 7.2 Rules (allow and deny table)

Clients never write anywhere. The server bypasses rules (Admin SDK for Firestore; service-account token for Realtime Database). No rule reads other documents.

| Database | Path | Operation | Allowed when |
| --- | --- | --- | --- |
| Firestore | `orderTracking/{orderId}` | `get` | `request.auth != null && resource.data.printUserId == request.auth.uid` |
| Firestore | everything else | any | never |
| Realtime Database | `/doorbell/$shopId` | read (including streaming) | `auth != null && auth.token.shopId === $shopId` |
| Realtime Database | everything else | any | never |

### 7.3 Rules tests (minimum)

**Firestore:**

- A guest can get their own tracking document.
- A guest can't get another guest's tracking document.
- Listing `orderTracking` is denied.
- Shop users can't read orders or jobs directly (server-only).
- Any write is denied.

**Realtime Database:**

- A shop A user can read `/doorbell/A`.
- A shop A user can't read `/doorbell/B`.
- Unauthenticated reads are denied.
- Any write is denied.

### 7.4 Indexes

| Collection | Scope | Fields | Used by |
| --- | --- | --- | --- |
| `printJobs` | Collection group | `shopId` ASC, `agentId` ASC, `status` ASC, `createdAt` ASC | `sync` claim |
| `printJobs` | Collection group | `shopId` ASC, `agentId` ASC, `status` ASC, `claimedAt` ASC | `sync` re-delivery of stuck jobs |
| `printJobs` | Collection group | `shopId` ASC, `status` ASC | Full board (unfinished jobs) |
| `printJobs` | Collection group | `shopId` ASC, `updatedAt` ASC | Board changes (jobs) |
| `orders` | Collection | `status` ASC, `payment.status` ASC | `sync` auto-accept |
| `orders` | Collection | `status` ASC, `createdAt` DESC | History filtered by status |
| `orders` | Collection | `searchKeys` ARRAY_CONTAINS, `createdAt` DESC | Search |
| `printUsers` | Collection | `shopId` ASC, `ipAddress` ASC | Session resume (existing query; check whether it needs a composite) |

- Automatic single-field indexes cover the full board's `status in [...]` and the order changes' `updatedAt >`.
- Drop draft indexes on fields that are never written.

### 7.5 Project setup checklist

1. Create the Realtime Database instance in **`asia-southeast1`**. Record its URL (`https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app`).
2. Register the customer web app and record its config. The desktop needs only the Web API key and the database URL.
3. Restrict the browser API keys:
   - the web key to the Identity Toolkit, Token Service and Firestore APIs and the customer domain;
   - the desktop key to the Identity Toolkit and Token Service APIs.
4. Deploy indexes and wait until they're built; then deploy rules: `firebase deploy --only firestore:indexes`, then `firebase deploy --only firestore:rules,database`.
5. Server env: `FIREBASE_DATABASE_URL` (plain), `PRINT_USER_COOKIE_SECRET` (secret) and `ALLOW_MOCK_PAYMENTS` (local and staging only). `apps/server/apphosting.yaml` lists only run settings today (`minInstances: 1`), so set them where the existing variables are set, and document them in `apps/server/docs/deployment.md` (the variables table at 64–78).
6. Budget alerts (12.3).

---

## 8. Desktop UI (`apps/print-shop`)

There's no Firebase dependency in the desktop. `App.tsx` keeps owning state, and new logic goes into small modules under `src/lib/`. The pure parts are tested with Vitest.

### 8.1 Config

- **Env:** add `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_DATABASE_URL`, passed to the agent in `cloud.configure`. Add them to `.env.example` (today it has only `VITE_SERVER_BASE_URL`), and add an `ImportMetaEnv` interface to `vite-env.d.ts` (today it's only the `vite/client` reference).

### 8.2 Tokens

- **`request()` in `cloud.ts`:**
  - gets the bearer token from `agent.getIdToken()` (pipe request `cloud.getIdToken`; cached in the agent, so fast);
  - on a 401, calls `getIdToken({ forceRefresh: true })`, retries once, and otherwise shows the login screen.
- **Remove `idToken`** from React state, from `sessionRef`, and from every effect dependency.

### 8.3 Login, boot and sign-out (`App.tsx`)

- **`handleLogin` / `handleRegister`:**
  1. API response.
  2. `storeRefreshToken` (existing).
  3. `connectDevice`: register; no credential hand-off and no `beatOnce`.
  4. `agentNotify("cloud.session", { shopId, agentId, idToken, expiresAt })`.
- **`restoreSession`** (boot):
  1. `waitForAgent`.
  2. `agentNotify("cloud.configure", { serverBaseUrl, firebaseApiKey, databaseUrl })`.
  3. `getIdToken()`. If not signed in, show the login screen.
  4. Otherwise `fetchCurrentUser`, `connectDevice`, then `cloud.session`.
- **`handleSignOut`:**
  1. `markDeviceOffline` (also marks printers OFFLINE).
  2. `logoutSession` with `allDevices: false` (5.1).
  3. `agentNotify("cloud.clear")`.
  4. `clearStoredRefreshToken`.
- **Window close:** nothing in the UI. Closing the window exits the app; the agent exits with it and marks the PC offline itself (10.1). A JS `onCloseRequested` handler would also need the `core:window:allow-destroy` permission, which isn't granted, and would miss crashes.
- **On `agent:ready`:** send `cloud.configure` and `cloud.session`. The bridge never reconnects (9.1) and the agent now starts and stops with the app, so this fires once per app start.

### 8.4 Board (`src/lib/board.ts`, new)

- **`loadBoard()`:** `GET .../board`, returning a `BOARD_SNAPSHOT` event into `OrderStore` (replaces `ORDERS_SNAPSHOT`).
- **`refreshBoard(cursor)`:** `GET .../board?since=`, returning a `BOARD_DELTA` event.
  - The reducer upserts by `(id, updatedAt)`.
  - Orders whose status left the active set move out of the New, Active and Ready tabs.
  - Jobs update `jobsByOrderId`.
- **When it fetches:**
  - on start (full);
  - on `board.changed` (from the agent), debounced 300 ms, **only when the window is visible** (`document.visibilityState === "visible"` and the Tauri window not minimized); otherwise it sets `dirty`;
  - on focus, restore or a visibility change when `dirty`, or after more than 60 s since the last fetch;
  - after the operator's own actions (accept, reject, ready, complete, dispatch, retry, cash), from the response, with no extra fetch.
- **In-app notifications** (the existing `pushNotification`) for new SUBMITTED orders in a delta. Native notifications while minimized come from Rust (9.1).
- **Stale-work nudge:** send `sync.request` to the agent, at most once a minute, if the board shows either of these:
  - a QUEUED job for this PC's agent older than 60 s;
  - an ONLINE order that is SUBMITTED and PAID for more than 60 s while the shop's `autoAcceptPaidOnline` is on.

  This catches a lost ring (6.9) the next time the board is fetched, for example on focus or restore. It adds no requests of its own, because it reads a board the UI already has.

### 8.5 History and search (`src/lib/order-history.ts`, new)

| View | API |
| --- | --- |
| Completed tab | `GET .../orders?status=COMPLETED,REJECTED,CANCELLED&limit=50`, "Load more" with `cursor` |
| All tab | `GET .../orders?limit=50` |
| Date picker | `GET .../orders?from=YYYY-MM-DD&to=YYYY-MM-DD`. Shop-time days are computed on the server, which fixes the UTC bug in `filterOrders`. |
| Search | `GET .../orders/search?q=` (3 or more characters) |
| Payment filter | In memory, on the loaded page |

### 8.6 Connection badge

From the agent's `cloud.state`:

- `doorbell`: connected, connecting, polling or offline;
- `token`: valid, refreshing or invalid.

It replaces the heartbeat-driven `cloud` state, the "Order stream: …" label, and Settings' `lastHeartbeatAt`/`streamState`. If `token` is `invalid`, the UI shows the login screen.

### 8.7 Removals

- **`App.tsx`:**
  - the heartbeat effect (353–371), `beatOnce`, `lastHeartbeatAt`;
  - the stream effect (334–351);
  - the stream-state references: the label at 989 and the `streamState` prop at 1081, plus `SettingsScreen.tsx` 32, 52 and 378. Reword the copy at 1168 ("Live counts from the order stream") and 1210 ("No orders in the live stream yet.");
  - `idToken` state.
- **`cloud.ts`:**
  - `sendDeviceHeartbeat`, `listShopOrders` (old full list), `parseOrderStreamMessage`, `streamShopOrders`;
  - `updateOrderPrintJob`, `markDocumentShredded` (already unused);
  - `refreshSession` usage at boot.
- **`agent.ts`:** `storeAgentCloudCredential`.
- **`protocol.ts` / `orders.ts`:** remove the SSE union `OrderStreamEvent` (`protocol.ts` 195–199) and the reducer's `connection` case. `ORDERS_SNAPSHOT` becomes `BOARD_SNAPSHOT` / `BOARD_DELTA`. **Keep** `ORDER_STATUS_CHANGED` and `PRINT_JOB_CHANGED`: operator-action responses feed them (`App.tsx` 639–641, 660, 684, 800, 826).
- **Tests:** the SSE-parser test in `orders.test.ts` (46–53) becomes board-merge tests; keep the reducer-merge test (55–66).

---

## 9. Pipe protocol and Rust bridge

### 9.1 Rust (`src-tauri/src/agent/bridge.rs`, `commands.rs`, `lib.rs`, `capabilities/default.json`)

- **`AgentBridge::notify(method, params)`:**
  - writes a JSON-RPC frame **without `id`**. It takes the `inner` mutex, which holds the writer, but not `call_lock`, which a pending `call` holds for up to 20 s;
  - is a silent no-op when the bridge isn't ready (the UI re-sends on `agent:ready`).
- **Commands:**
  - `agent_notify(method, params)`, allowlisted to `cloud.configure`, `cloud.session`, `cloud.clear` and `sync.request`;
  - `agent_get_id_token(forceRefresh)`, a normal `call` to `cloud.getIdToken`;
  - redact `cloud.session` and `cloud.getIdToken` results in logs.
- **Native attention:** in `read_loop`, when the agent sends `orders.attention`:
  - show a Windows notification with `tauri-plugin-notification` ("New order ORD-1234");
  - call `window.request_user_attention(Informational)`;
  - then forward it as `agent:event`, as today.

  This runs in Rust, so it works while the web view is throttled.
- **New dependency:** `tauri-plugin-notification`, plus capability permission `notification:default`.
- **Events:** emit `agent:ready` when the bridge becomes ready.
- **Agent lifetime (`boot.rs`):** pass `--parent-pid <app pid>` to the sidecar. The agent already supports it (`ParentProcessWatcher`, `Program.cs` 70–73) but it isn't passed today (`boot.rs` 16), so the agent outlives the window. It keeps polling and printing after the app closes, and after sign-out, because nothing clears its agent key. See design doc decision 10.
- **Remove** `set_agent_cloud_credential`.
- **Known limit, not in scope:** the bridge never reconnects after the agent process dies (`read_loop` breaks on a pipe error; `connect_pipe` runs only at boot). The UI shows the agent failed until the app restarts.
- **One call at a time:** the bridge serialises calls (`call_lock`). `cloud.getIdToken` returns a cached token in milliseconds; a refresh (about hourly) takes about 0.2–1 s.

### 9.2 Messages

| Direction | Method | Kind | Params / result | When |
| --- | --- | --- | --- | --- |
| UI → agent | `cloud.configure` | notification | `{ serverBaseUrl, firebaseApiKey, databaseUrl }` | Boot and `agent:ready` |
| UI → agent | `cloud.session` | notification | `{ shopId, agentId, idToken?, expiresAt? }` | After login or boot device registration; `agent:ready` |
| UI → agent | `cloud.clear` | notification | `{}` | Sign-out |
| UI → agent | `sync.request` | notification | `{}` | The board's stale-work nudge; Settings "Sync now" |
| UI → agent | `cloud.getIdToken` | request | `{ forceRefresh? }` → `{ signedIn, idToken?, expiresAt?, claims?: { shopId, shopUserId, role } }` | Each API call |
| Agent → UI | `board.changed` | notification | `{ boardAt }` | The doorbell's `boardAt` changed |
| Agent → UI | `orders.attention` | notification | `{ type, orderId, orderNumber }` | `last.type` is `order_submitted` or `order_paid`, not seen before (handled in Rust too) |
| Agent → UI | `cloud.state` | notification | `{ doorbell, token, pendingReports, lastSyncAt?, lastError? }` | On change |

The existing `secrets.getRefreshToken`, `secrets.setRefreshToken` and `secrets.clearRefreshToken` stay.

---

## 10. Print agent (`apps/print-agent`)

No new NuGet packages: `System.Net.Http` and `System.Text.Json` cover everything. That keeps the agent's "no Firebase SDK" rule.

### 10.1 Protocol and handlers

- **`Contracts/Protocol/Protocol.cs`:**
  - add `cloud.configure`, `cloud.session`, `cloud.clear`, `sync.request` and `cloud.getIdToken` to `RpcMethods`;
  - add `board.changed`, `orders.attention` and `cloud.state` to `RpcNotifications`;
  - remove `secrets.setAgentCloudCredential` and `secrets.clearAgentCloudCredential`.
- **`Contracts/Protocol/Messages.cs`:** add `CloudConfigureRequest`, `CloudSessionRequest`, `IdTokenRequest` and `IdTokenResult`. Remove `AgentCloudCredentialRequest`.
- **`Core/Handlers/Handlers.cs`:**
  - the notification handlers hand off to the services and return at once (the pipe handles frames one after another);
  - `cloud.getIdToken` returns the cached token if it's valid for more than 60 s, and otherwise awaits the single-flight refresh (10 s timeout).
- **`Core/AgentRuntime.cs` and `Host/Program.cs`:**
  - construct the cloud services before the dispatcher and inject them;
  - the worker's job-event callback writes to the outbox instead of calling `ReportAsync`;
  - **shutdown** (the parent app exited, or `shutdown`): close the stream, then make a best-effort `POST /devices/offline` (2 s timeout) if a session is active, then exit. Pending reports stay in SQLite and flush on the next start.
- **Remove:** the `agentCloud` credential from `WindowsCredentialStore`, `ISecretStore`, `MemorySecretStore`, and the `AgentCloudCredential` record.

### 10.2 `FirebaseTokenManager` (new, `Core/Cloud/`)

- **Inputs:** `firebaseApiKey` (from `cloud.configure`) and the refresh token from `ISecretStore`.
- **State:** `{ idToken, expiresAt, claims }`, held in memory only.
- **Refresh** with the Secure Token API (5.2): single-flight; scheduled at 55 minutes while signed in; on demand on a 401, or on `auth_revoked` when the cached token has less than 5 minutes left. Store a rotated refresh token.
- **Reuse:** port `TokenClient.cs` from `spikes/doorbell/listener/`.
- **Failure:** an HTTP 400 from Google (`TOKEN_EXPIRED`, `USER_DISABLED`, `INVALID_REFRESH_TOKEN`) sets `token: invalid` and stops the doorbell. Network errors retry with backoff (1 s doubling to 60 s).
- **`cloud.session` with `idToken`** seeds the cache, so there's no refresh straight after login.
- **`cloud.clear`:** forget everything in memory. The refresh token is cleared by the UI's `secrets.clearRefreshToken`.

### 10.3 `DoorbellClient` (new)

**Stream:**

- Request: `GET {databaseUrl}/doorbell/{shopId}.json?auth=<idToken>`, with `Accept: text/event-stream`, `HttpCompletionOption.ResponseHeadersRead` and an infinite timeout. Follow 307s (`HttpClient` does by default).
- An SSE parser handles `event:` and `data:` lines, multi-line data, CRLF and comments. Unit-tested. Port `SseParser.cs` from `spikes/doorbell/listener/`; it already passed against the real database and the mock server.

| Event | Action |
| --- | --- |
| `put` (path `/`) | Replace the cached value |
| `patch` | Merge keys |
| `keep-alive` | Reset the watchdog. Arrives after exactly 30 s of silence (spike). |
| `cancel` | Rules denied the read: log, set `doorbell: offline`, ask the token manager to force a refresh, reconnect once |
| `auth_revoked` | Reconnect with the cached token if it has 5 minutes or more left; otherwise refresh first (10.2). Arrives at exactly 60 min on a connection. |

**After each value change:**

- `workAt` greater than the last handled → `AgentSyncService.Signal()`. In-memory `lastWorkAt` starts at 0, so the first value after any start syncs once.
- `boardAt` changed → notify `board.changed`.
- `last` changed with type `order_submitted` or `order_paid`, and `(type, orderId)` not in the last 50 seen → notify `orders.attention`.

**Staying connected:**

- **Watchdog: 65 s.** Reconnect if no event, keep-alive included, arrives for 65 s (2 × the measured 30 s keep-alive, plus slack).
- **Every connection attempt ends in one of these outcomes** (as in the spike's listener):

  | Outcome | When | Next step |
  | --- | --- | --- |
  | Healthy | It received a `put` and stayed up 5 s or more, or it ended with `auth_revoked` | Reconnect at once; reset backoff and the broken count |
  | Unreachable | DNS failure, connect failure, TLS failure, or a token refresh network error | Back off (1 s doubling to 60 s, with jitter). **Doesn't count** toward the fallback: polling would fail too. |
  | Broken | The server answered but the stream didn't work: an HTTP error other than 401, no `put`, closed within 5 s, `cancel`, or the watchdog fired | Back off; add 1 to the broken count |
  | Fatal | The token is invalid (10.2) | Stop; `cloud.state.token = "invalid"` |

- **Polling fallback:** **3 broken in a row** switches to polling `GET {databaseUrl}/doorbell/{shopId}.json?auth=` every 60 s for 30 minutes, then tries the stream again. `cloud.state.doorbell = "polling"`. A buffering network hits this in about 4 minutes (3 watchdog periods plus backoff); a blocking one in seconds.
- **Wake-ups:** on Windows network-availability and address-change events, and on resume from sleep (a jump in wall-clock time against the monotonic clock), cut short any backoff wait and reconnect at once. Also close the current stream on resume, because a socket from before sleep is usually dead. The spike's listener wakes on network events but only logs the clock gap, so the resume part is new.
- **On `cloud.clear`, sign-out, or no session:** close the stream.

### 10.4 `AgentSyncService` (replaces the poll loop in `AgentCloudSynchronizer`)

- **Trigger:** a coalescing signal (`Channel` with capacity 1 and drop-write). Sources: the doorbell `workAt`, `sync.request`, and a new session.
- **Loop:** wait for the signal → `POST .../agents/{agentId}/sync` → for each claimed job:
  1. Download with a **separate download client** (5 min timeout) to `{stagingRoot}/{jobId}/document.{ext}`.
  2. Verify SHA-256.
  3. `Enqueue` locally with `CloudOrderId`, `CloudDocumentId`, `LeaseId`, `CloudShopId`, `CloudAgentId`.
  4. On a staging failure, outbox a FAILED report with `AGENT_STAGING_FAILED`.
- **Repeat at once while `more`.** Publish `cloud.state.lastSyncAt`.
- **Skip** any job already in SQLite with the same `cloud_job_id` **and** `lease_id`, whatever its local state. Re-delivered jobs (6.3) come with the same lease, so a job that already printed, or is waiting for its report to go out, is never printed twice. A job retried by the operator has a new lease and is printed again, as intended. Today `lease_id` is stored (`SqliteJobStore.cs` 117) but never used.
- **On a 401:** the token manager refreshes, then retry once.

### 10.5 `ReportOutbox` (new) and SQLite

**SQLite** (`Core/Jobs/SqliteJobStore.cs`), new columns on `jobs`:

| Column | Purpose |
| --- | --- |
| `cloud_shop_id`, `cloud_agent_id` | Reports go out only while a session for the same shop and agent is active |
| `report_state` | `none` \| `pending` \| `sent` \| `acked` \| `rejected`. Replaces `cloud_acked`; migrate `cloud_acked = 1` to `acked`. |
| `report_attempts`, `report_next_at`, `report_last_error` | Backoff and diagnostics |

**Flow:**

- The worker callback sets `pending` when a local job ends (COMPLETED, FAILED or CANCELLED) and signals the outbox. No HTTP happens in the callback.
- **Local cancel** (`jobs.cancel`) must also set `pending`. Today it publishes no event, and CANCELLED reaches the cloud only through the sweep that's being removed.
- **At start,** jobs left `printing` are marked `failed` (`SqliteJobStore.cs` 63–72, existing). They get `pending`, so the outbox reports them FAILED.
- The outbox batches pending reports for the active shop and agent (up to 20, waiting 1 s to gather a batch) and calls `POST .../jobs/report`.
- For each result:
  - `ok` → `acked`;
  - `lease_mismatch`, `invalid_state` or `not_found` → `rejected`;
  - `retry` → `pending` with backoff.
- A whole-request failure (network, 429, 5xx) means backoff: 1 s, doubling to 5 min, with jitter, honouring `Retry-After`.
- **Timers exist only while reports are pending.** The outbox flushes on start and on each new session.
- **Local `Retry`** resets `report_state` to `none`.

**Removed:**

- `RunAsync` polling;
- the `SynchronizeOnceAsync` sweep;
- the per-job claim, ticket, PATCH and shred calls;
- the PRINTING report on `job.started`;
- the agent API key headers.

### 10.6 Tests (`tests/Ctrlp.PrintAgent.Tests`, xUnit, fake `HttpMessageHandler`)

1. **SSE parser:** `put`, `patch`, `keep-alive`, `cancel`, `auth_revoked`; multi-line data; CRLF.
2. **Token manager:** refresh succeeds; rotated token stored; single-flight; invalid refresh token → `invalid`; network backoff.
3. **Doorbell client:** reconnects after a drop; the watchdog fires at 65 s; `auth_revoked` with a fresh cached token → reconnect with no refresh; `auth_revoked` with a nearly expired token → refresh → reconnect; 40 s unreachable → **no** fallback, and back on the stream within 5 s of the server returning; 3 broken (HTTP 500, or no data until the watchdog) → polling → back to streaming after 30 minutes; a healthy connection resets the count; a newer `workAt` signals sync exactly once per change; attention de-duplication.
4. **Sync service:** coalescing (10 signals → 1 call); the `more` loop; staging; de-duplication; a staging failure → FAILED outboxed.
5. **Outbox:** result mapping; backoff and `Retry-After`; held for another shop; migration from `cloud_acked`.
6. **Handlers:** notifications return in under 10 ms; `cloud.getIdToken` returns the cached token without HTTP.

---

## 11. Customer web app (`apps/printUserWebapp`)

The customer is in a foreground browser tab, so a Firestore listener is fine here.

### 11.1 Tracking with a listener

**Where:**

- `src/hooks/use-order-tracking.ts`
- `src/data/tracking-repository.ts`
- `src/data/tracking-constants.ts`
- `src/app/s/[slug]/order-status/page.tsx`

**Tasks:**

- **New `src/lib/firebase-client.ts`,** loaded with a dynamic `import()` on the tracking page only.
  - Auth with `browserSessionPersistence`; Firestore with the in-memory cache.
  - Env: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` (BUILD and RUNTIME on App Hosting).
- **Session provider:** keep `firebaseToken` in memory (context).
- **`use-order-tracking.ts`:**
  1. Sign in with `firebaseToken`.
  2. `onSnapshot(doc(db, "orderTracking", orderId))`.
  3. `mapTrackingDocToTracking`.
  4. Detach on a terminal status or unmount.
- **Fallback:** no token, or the listener errors → one `GET /public/session/orders/{orderId}` and a Refresh button.
- **"Shop hasn't confirmed your order yet":** status `SUBMITTED` for more than 10 minutes since `paidAt ?? submittedAt`.
- **Remove:**
  - the poll (78–106) and `POLLING_INTERVAL_MS` (`tracking-constants.ts` 113). Keep `pollLatestOrderStatus` (`tracking-repository.ts` 607–619) as the one-shot fetch behind the fallback's Refresh button; it already powers the manual Refresh (`use-order-tracking.ts` 113);
  - the FAILED and PRINT_FAILED mappings;
  - the dead code `createFromSubmittedOrder`, `createDemoOrder`, `getRealDocumentsFromSession` and `getCachedOrderTracking`;
  - the tracking cache: `saveCachedOrderTracking` (504–514) and its calls in `fetchOrderTracking` (603) and `transitionOrderStatus` (635). It's written but never read;
  - the simulator bar and `transitionOrderStatus`.

### 11.2 Fewer guest API calls

- **Cart reuse:** a module-level store holds the last `GuestSessionDto`, updated by every cart-changing response. The upload page restore (`s/[slug]/page.tsx` 106), the customize reconcile (`customize/page.tsx` 106) and `loadOrderDraft` (`order-repository.ts` 144) use it, and call `GET /public/session` only on a hard load.
- **One quote:**
  - remove the quote in `initiateOnlinePaymentTransaction` (`payment-repository.ts` 56);
  - debounce the quote after review edits (`use-review-order.ts` 182) by 500 ms;
  - delete `refreshPriceAuthoritatively` (already has no callers).
- **Draft load:** the mount effect in `use-review-order.ts` (90–117) copies `loadDraft` (56–85). Call `loadDraft` instead, so the debounce and the cart reuse apply in one place.
- **Dead code:** `src/hooks/use-payment.ts` (no importers) and the redirect-only payment page logic.

### 11.3 The proxy stays

Revisit above about 2,000 orders a day.

---

## 12. Observability and cost checks

### 12.1 Per-request Firestore counters (server)

- **Enabled by** `FIRESTORE_OP_COUNTERS=1`. On in staging.
- **Mechanism:** an `AsyncLocalStorage` request context in the route runners (`runShopOrder`, `runPrintUser`, `withOwnShop`, and the agent routes). Count by wrapping Admin SDK prototypes once, at `getFirebaseFirestore()` initialisation: document get/set/update/delete/create, `Query.get`, transaction operations, and batch commits.
- **Log:** one JSON line per request: `{ route, method, status, ms, reads, writes, deletes, rings, ringFailures, coldStart }`.

### 12.2 Cost checks in staging

- **Order script:** places N orders end to end (customer flow, agent harness). It asserts reads, writes and requests per order within ±20% of design doc section 10.1.
- **Idle check:** a PC open 1 hour with no orders.
  - 0 API requests (logs);
  - 0 Firestore reads (Monitoring);
  - doorbell bytes at about 10 KB or less for the hour (Realtime Database usage). The spike measured about 6.4 KB.

### 12.3 Budget and usage alerts

- **Cloud Billing budget:** for example $5/month, alerting at 50%, 90% and 100%.
- **Cloud Monitoring:**
  - Firestore reads above 40,000/day;
  - writes above 16,000/day;
  - Cloud Run requests above 50,000/day;
  - Realtime Database sent bytes on pace for more than 7 GB/month.
- **Log-based metrics:**
  - `ring_failed`: alert above 10 an hour. Rings that never landed leave work waiting (6.9);
  - `ring_unknown`: chart only. A timeout that probably landed.

---

## 13. Work breakdown

Estimates are for one engineer who knows the code. Dependencies are by task ID.

### Phase 0: gate

| ID | Task | Depends on | Estimate | Status / done when |
| --- | --- | --- | --- | --- |
| P0-01 | Firebase project setup: `firebase.json`, `.firebaserc`, web app registration, key restrictions, env values (7.1, 7.5) | — | 0.5 d | **Partly done.** The Realtime Database instance already exists (`meetctrlp-default-rtdb`, `asia-southeast1`), and the 7.2 Realtime Database rules are deployed on `meetctrlp`. Still needed: the files, the emulators, a staging project, key restrictions and env values. Done when all three emulators start and the config values are recorded. |
| P0-02 | Doorbell spike (3.2) | — | 1 d | **Done, 15 Oct 2026: go.** |
| P0-03 | Field checks on shop networks (3.3) | P0-02 | 1 d (mostly waiting) | All 3.3 rows recorded in this doc. Runs alongside Phase 1. **Gates shipping the agent to shops, not coding.** |
| P0-04 | Spike clean-up: `node scripts/setup.mjs cleanup --keep-rules` in `spikes/doorbell` (deletes the test user and `/doorbell/spike`, keeps the 7.2 rules). Delete the shop-kit copies, and `spikes/doorbell/.secrets/` and `shop-kit/` on the dev PC. | P0-03 | 0.1 d | The `doorbell-spike-agent` user is gone from `meetctrlp`. |

### Phase 1: foundation (server, rules, model)

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P1-00 | **Security, do first:** gate the mock payment route behind `ALLOW_MOCK_PAYMENTS` (6.2) | — | 0.1 d | The route returns 404 in production; a test covers both settings. Can ship on its own today. |
| P1-01 | Firestore and Realtime Database rules, with tests (7.2, 7.3) | P0-01 | 1 d | All tests in 7.3 pass |
| P1-02 | Indexes file and deploy (7.4) | P0-01 | 0.25 d | Indexes built in staging |
| P1-03 | `ShopPrincipal` auth, claims required, registration returns a token with claims, logout `allDevices`, route audit (4.7, 5.1, 6.1) | — | 1.25 d | No `lookupIdToken` on request paths; a newly registered user's first API call succeeds; audit table in the PR |
| P1-04 | Guest `firebaseToken` on session start (5.4) | P1-03 | 0.25 d | The emulator can sign in with it |
| P1-05 | `applyOrderChange` for every writer in 4.1, lifecycle, drop `statusHistory`, transitions by status, payment confirm idempotent by state, one active job per document, `searchKeys`, `completedDocumentIds`, tracking copy (4.1–4.3, 6.2) | — | 2.25 d | Every writer uses the helper; unit tests for transitions, the copy, and the dispatch guards |
| P1-06 | `ringShop` and every call site in the ring table; `FIREBASE_DATABASE_URL` (6.9) | P1-05, P0-01 | 0.75 d | Rings visible in the emulator for each event; failures logged, never thrown |
| P1-07 | Op counters and budget alerts (12.1, 12.3) | — | 0.5 d | Log lines in staging; alerts configured |
| **Phase 1** | | | **6.35 d** | |

**Phase 1 status (15 Oct 2026): code written, not deployed.** Server tests (35) and typechecks pass. What differs from the tasks above, and what's still open:

- **P1-00:** done. The web app uses this route as its only online payment step (there's no gateway yet), so online payments now work only where `ALLOW_MOCK_PAYMENTS=1`. Locally it's set in `apps/server/.env.development.local`, which only `next dev` reads.
- **P0-01 / P1-01 / P1-02:** `firebase.json`, `.firebaserc`, both rules files, the indexes, and the rules tests are in. **The rules tests pass** (11 of 11 on the emulators, `pnpm firebase:rules:test`, 15 Oct 2026; firebase-tools 15 needs JDK 21+). Not yet done: a staging project, API key restrictions, and deploying the indexes and rules.
- **P1-03:** done as specified, plus one addition: **login repairs claims.** If a user's token lacks the expected claims (an account made before claims were required, or a changed role), login sets them and returns a refreshed token. Without this, existing dev accounts would get `CLAIMS_MISSING` on every call.
- **P1-04:** done. If signing the token fails, the session response carries `firebaseToken: null` and the tracking page falls back to fetching.
- **P1-05:** done, with one deliberate deviation: **server auto-accept on payment stays until P2-01.** Removing it before the agent's `sync` exists would leave paid orders waiting forever. Payment confirmation is already idempotent by state. The old agent paths (`claimPrintJob`, `updatePrintJob`) also go through `applyOrderChange` until P2 deletes them.
- **P1-06:** done. Rings from one request are merged and sent once before the response, through a small per-request context (`src/lib/request-context.ts`) that the route runners open. Not exercised against the real database yet; the spike already proved the PATCH with a token of the same scopes.
- **P1-07:** counters done (`FIRESTORE_OP_COUNTERS=1`). The alerts aren't configured; the steps are in `apps/server/docs/deployment.md` ("Cost alerts").

### Phase 2: agent-driven delivery

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P2-01 | Server `sync` (with re-delivery) and `report`, retry rescue and re-routing, routing preference, accept `agentId`, remove server auto-accept, `devices/offline` printers, `lastActiveAt`, maintenance job (6.3, 6.5–6.7, 6.10) | P1-03, P1-05, P1-06 | 3 d | Unit tests (auto-accept race, claim, re-delivery, leases, replays, READY, shred retry, shared-document delete guard, retry from each state); old agent routes deleted |
| P2-02 | Server `board`, history and search endpoints (6.4) | P1-05 | 1 d | Delta correctness tests (overlap, duplicate removal, caps, left-active-set) |
| P2-03 | Agent `FirebaseTokenManager` and `DoorbellClient`, with the polling fallback and tests (10.2, 10.3). Port `SseParser.cs`, `TokenClient.cs` and the outcome rules from `spikes/doorbell/listener/`. | P0-02 | 1.5 d | Tests 10.6 #1–3 pass; runs against staging for 3 hours without leaks |
| P2-04 | Agent `AgentSyncService`, `ReportOutbox`, SQLite migration, download client, with tests (10.4–10.6) | P2-01, P2-03 | 2 d | Tests 10.6 #4–6 pass; end-to-end print in staging |
| P2-05 | Rust `notify`, commands, native notifications, `agent:ready`, `--parent-pid`; C# protocol, handlers, and shutdown that marks the PC offline (9, 10.1) | — | 1 d | Notifications arrive; a toast shows while minimized; handler latency test passes; closing the app ends the agent and marks its printers OFFLINE |
| P2-06 | Desktop: token from the agent, boot, login and sign-out, board client with visibility, connection badge, history and search, stale-work nudge, retry on stuck jobs (8.2–8.6) | P2-02, P2-05 | 1.5 d | Orders screen works with no stream; board-merge tests pass |
| P2-07 | Removals (8.7, 6.6) and docs (section 17) | P2-04, P2-06 | 0.5 d | Grep finds none of the removed symbols; docs updated |
| **Phase 2** | | | **10.5 d** | |

**Phase 2 status (15 Oct 2026): code written, not deployed.** Server tests (52), agent tests (76), desktop tests (38), typechecks, `cargo build` and both Next.js builds pass. What differs from the tasks above, and what's still open:

- **P2-01:** done. Payment confirmation no longer auto-accepts; the agent's `sync` does, with this agent preferred for routing and no ring back to itself (`quietAgentId`). The shop config read is cached for 60 s per instance (part of P3-02's "config cache"). Three new indexes (`orderTracking` by status and `updatedAt`; orders by status and `rejectedAt`, and by status and `cancelledAt`) back the maintenance job, which runs from Cloud Scheduler (`apps/server/docs/deployment.md`, "Daily clean-up"). The rules are unit-tested as pure decisions (`job-model.test.ts`); the Firestore paths themselves have no automated test, because there's no emulator run yet (Java).
- **P2-02:** done; delta rules tested in `board-model.test.ts`. The SSE stream route and its helpers are deleted.
- **P2-03, P2-05:** done (`80ad1bf`). The 3-hour staging run hasn't happened.
- **P2-04:** done. Not yet run end to end against staging.
- **P2-06:** done, plus one rule the plan didn't spell out: **cloud jobs are retried in the cloud only.** Re-printing the agent's local copy as well would print twice. The stale-work nudge also covers paid orders waiting for the agent to accept them.
- **P2-07:** done. A grep for the 8.7 and 6.6 symbols finds none. The section 17 docs are updated.

### Phase 3: customer side and trims

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P3-01 | Tracking listener, guest sign-in, fallback, "not confirmed" state, dead code (11.1) | P1-01, P1-04, P1-05 | 1.5 d | Live tracking with 0 API requests after load |
| P3-02 | Signed cookie, read-once, config cache, cart reuse, one quote (6.8, 11.2) | — | 1.5 d | Per-order counts within ±20% of the model |
| P3-03 | `minInstances: 0`, `deployment.md`, staging cost and idle runs (12.2) | P2-07 | 0.5 d | Cost check and idle check pass |
| **Phase 3** | | | **3.5 d** | |

**Phase 3 status (15 Oct 2026): code written, not deployed.** Web app typecheck and build pass; its lint findings are all older than this work.

- **P3-01:** done. The one-off read behind the fallback and Refresh is `fetchOrderTracking` (it replaces `pollLatestOrderStatus`), and `GET /public/session/orders/{orderId}` now returns the tracking copy, not the full order. The mapping is `normalizeTrackingDocument` plus `mapTrackingToOrder`. Without the four `NEXT_PUBLIC_FIREBASE_*` values, the page reads once and offers Refresh. "0 API requests after load" still needs checking in a browser against staging.
- **P3-02:** done. The cart store lives in the web app's `src/lib/cloud.ts`. Because the session start already returns the cart, `GET /public/session` now runs only for the next order after one is placed. The online submit sends the price the customer saw and relies on the server's `priceChanged` check, not a separate quote. Review edits are quoted once they pause for 500 ms, and submit flushes a pending quote first. Also removed: the written-but-never-read submitted-order copy in `sessionStorage`, and the old payment page's unused components. The per-order count check needs staging.
- **P3-03:** `minInstances: 0` and `deployment.md` done. The staging cost and idle runs are open.

**Still open across all phases:** P0-01's staging project, key restrictions and env values; P0-03 field checks; deploying indexes and rules (the rules tests pass; rerun them before each rules deploy); budget and usage alerts; the Cloud Scheduler job; the staging runs above; and the manual cases in the [testing guide](./traffic-scaling-v2/TESTING_GUIDE.md).

**Total remaining: about 22 days** (Phase 0: 1.6 for P0-01, P0-03 and P0-04; Phase 1: 6.35; Phase 2: 10.5; Phase 3: 3.5). P0-02 (1 day) is done.

**Paths through the work:**

- **Critical path:** P2-03 → P2-04 → end to end (P0-02 is done). P0-03 must pass before the agent ships to shops.
- **Server line:** P1-03 → P1-05 → P1-06 → P2-01 → P2-02.
- **UI line:** P2-05 → P2-06.
- **Two engineers** (server and rules; desktop and agent) finish in about 2.5 weeks.
- **Start now:** P1-00 (ships on its own), P0-01, P1-03 and P1-05 on the server line; P0-03 field checks in parallel; P2-03 and P2-05 on the agent line, since they don't need the server changes.

**Release order** (no existing users): indexes → rules (both databases) → server → desktop installer → web app.

---

## 14. Test plan

### 14.1 Unit

| Area | Cases |
| --- | --- |
| Server: auth | Valid token and claims → principal; missing claims → 401; expired → 401; wrong shop → 403; registration returns a token that carries claims; logout revokes only with `allDevices: true` |
| Server: orders | Transition table (replay → no write; wrong state → 409); lifecycle times; tracking copy only for guest orders and only on visible changes; server-timestamp `updatedAt`; `searchKeys`; payment confirm on an already PAID order → no write, no ring; mock confirm → 404 without `ALLOW_MOCK_PAYMENTS`; accept replay → no second queue; dispatch → `JOB_ACTIVE` / `DOCUMENT_SHREDDED` |
| Server: sync | Auto-accept only when enabled and paid; a race between two agents → one accept; queued jobs prefer the caller; claim only this agent's QUEUED jobs; re-deliver this agent's DISPATCHING jobs older than 15 minutes with the same lease and a fresh URL, and not younger ones; `more`; ring decisions |
| Server: report | Replay `ok`; `lease_mismatch`; `invalid_state`; READY after the last document (also with duplicate jobs); a failed delete → `retry`; no delete while another active job uses the document |
| Server: retry | From FAILED, from QUEUED, and from DISPATCHING older than 15 minutes (but not younger); clears the lease; a new printer sets `agentId`, `printerName` and `printerSystemName`; a disabled printer is refused |
| Server: board | Full versus delta; 5 s overlap; caps → full; left-active-set; jobs by `updatedAt` |
| Server: ring | Body shape; awaited; one retry; never throws; coalesced per request; timeout → `ring_unknown`, HTTP error → `ring_failed` |
| Server: guest | Cookie sign and verify, expiry, IP mismatch, tampering; config cache |
| Desktop (Vitest) | Board merging (snapshot, delta, duplicates, moving out of active tabs); visible-only fetch with a dirty flag; stale-work nudge (queued job and paid unaccepted order); shop-time date parameters |
| Agent (xUnit) | 10.6 |
| Rules | 7.3 |

### 14.2 End to end (staging, real Windows PCs)

| # | Scenario | Expected |
| --- | --- | --- |
| E1 | ONLINE order, 2 files, window visible | Auto-accepted by `sync`; claimed; printed; READY. Payment → claim p95 under 2 s (warm). |
| E2 | Same, window **minimized for 1 hour** beforehand | Same timings. A native toast "New order" appears. |
| E3 | CASH order while minimized | Native toast; the operator restores the window, sees it on the board, accepts; printed; READY; cash; COMPLETED |
| E4 | App closed when a paid order arrives | Closing the app ended the agent and marked its printers OFFLINE. The order stays SUBMITTED; the customer sees "hasn't confirmed" after 10 minutes. App opened → first doorbell value → `sync` → accepted and printed. |
| E5 | Job fails → operator retries | FAILED → QUEUED (new lease); the stale report is rejected; prints on retry |
| E6 | Network cut for 2 minutes during printing | The report is queued, then sent; no duplicate print; the doorbell reconnects |
| E7 | Network cut for 40 minutes; Windows sleep and resume | The doorbell reconnects; the first value triggers `sync`; nothing missed |
| E8 | Session longer than 3 hours | Refresh at 55 minutes; hourly `auth_revoked` → reconnect with the cached token, back within 5 s; no 401s on the API |
| E9 | Two PCs, one paid order | One accept wins; jobs go to the winner's printers; the other PC claims nothing |
| E10 | Sign out, then a different shop signs in on the same PC | Doorbell switches shop; reports for the first shop are held |
| E10b | Same login on PCs A and B; sign out on A | B stays signed in and keeps printing past the next hourly refresh |
| E11 | Stream buffered or blocked on a test network (or a P0-03 shop network that failed) | Polling fallback within 5 minutes; jobs still arrive within about 60 s. Wi-Fi off for 2 minutes on a good network does **not** switch to polling. |
| E12 | Customer tracking from payment to handover | Live updates; 0 API requests after load; fallback works with Firestore blocked |
| E13 | Idle PC for 1 hour | 0 API requests; 0 Firestore reads; doorbell bytes within budget |
| E14 | The `order_paid` ring fails (inject an error), window minimized | `ring_failed` is logged. The order waits until the next work ring, an agent restart, or "Sync now". The stale-work nudge (8.4) also catches it the next time the board is fetched: any board ring for the shop while visible, or focus or restore. An agent reconnect alone doesn't. |
| E15 | Kill the agent right after `sync` returns a claimed job, before it's queued locally; restart the app more than 15 minutes later | The next `sync` re-delivers the job with the same lease; it prints once. Killing it **after** printing but before the report: re-delivery is skipped locally, and the outbox reports it. |
| E16 | A PC dies for good with a job DISPATCHING | After 15 minutes the operator retries it to another printer; it prints there; a late report from the dead PC gets `lease_mismatch` |

### 14.3 Cost acceptance

Run 12.2. Done when per-order counts are within ±20% of design doc section 10.1 and E13 passes.

---

## 15. Sequences

### 15.1 Desktop start (signed in before)

```text
UI                              Agent                             Google / Realtime Database           API
 │ waitForAgent ─────────────────▶│
 │ cloud.configure ──────────────▶│
 │ cloud.getIdToken ─────────────▶│ refresh token (Credential Manager)
 │                                │── Secure Token API ────────────────▶│
 │◀──────────────── { idToken, claims }
 │ GET /api/auth/me, POST /devices/register ───────────────────────────────────────────────────────────▶│
 │ cloud.session {shopId, agentId}▶│
 │                                │── GET /doorbell/{shop}.json (SSE) ─▶│
 │                                │◀─────────── put {boardAt, workAt, last}
 │                                │ workAt > 0 → POST sync ─────────────────────────────────────────────▶│
 │ GET /board ─────────────────────────────────────────────────────────────────────────────────────────▶│
```

### 15.2 ONLINE order to print (window minimized)

```text
Customer        API                                 Realtime Database        Agent                         Rust/UI
 │ pay ────────▶│ payment PAID (+ tracking copy)
 │              │ ring {workAt, boardAt, last: order_paid} ─▶│
 │              │                                            │── patch ───▶│
 │              │                                                          │ orders.attention ───────────▶│ toast
 │              │◀───────────────────────────────── POST sync ─────────────│
 │              │ accept (prefer agent), queue jobs, claim (leases), order PRINTING
 │              │──────────────────── accepted + claimed + download URLs ─▶│
 │              │                                                          │ download, verify, print
 │              │◀───────────────────────────────── POST jobs/report ──────│
 │              │ COMPLETED, completedDocumentIds, READY, delete storage object, ring board
 │◀── tracking listener: READY                                             │ board.changed ──────────────▶│ (fetched when visible)
```

### 15.3 CASH order

```text
API: order SUBMITTED → ring {boardAt, last: order_submitted} → agent → orders.attention → Rust toast
Operator restores window → UI GET /board?since= → sees order → POST accept {agentId}
API: SHOP_ACCEPTED, jobs QUEUED (this PC first) → ring {workAt} → agent sync → claim → print → report
```

### 15.4 Token renewal on the stream

```text
55 min: agent refreshes the ID token (Secure Token API); the open stream keeps its old token
60 min: Realtime Database sends auth_revoked → agent reopens the stream with the cached fresh token (no second refresh)
First put carries the current value → workAt unchanged → no sync
```

### 15.5 Job failure and retry

```text
Agent: print fails → outbox FAILED → report → API: job FAILED, ring board
Operator: Retry → API: FAILED → QUEUED, lease cleared, ring work → agent sync → claim (new lease)
A late report with the old lease → lease_mismatch → agent marks it rejected
```

---

## 16. Found along the way

| Finding | Where | Handled by |
| --- | --- | --- |
| A minimized WebView2 window doesn't deliver listener updates; Tauri's throttling switch is WebKit-only | Spike 3.1 | Revision 2 (agent-held doorbell) |
| **Rev 3:** the draft fallback rule ("5 failed connects in 10 minutes") put a PC on polling for 30 minutes after a 33 s Wi-Fi drop | Spike 3.2 | 10.3: only broken streams count, 3 in a row |
| **Rev 3:** ring PATCHes that time out may already have landed | Spike 3.2 | 6.9: `ring_unknown` versus `ring_failed`; 12.3 |
| **Rev 3:** the draft said an agent reconnect catches up a lost ring. It doesn't, because the doorbell value never changed | 6.9, E14, design doc 11 | 6.9 lists what does catch up; 8.4 nudge also covers paid orders waiting for auto-accept; design doc decision 9 |
| **Rev 3:** with a 55-minute proactive refresh, refreshing again on `auth_revoked` wastes a call | 10.2 | Reconnect with the cached token |
| **Rev 3, security:** the mock payment route has no environment check; any guest can mark their own ONLINE order PAID in production | `payments/mock-confirm/route.ts`, `print-user.service.ts` 439 | **P1-00** (do first) |
| **Rev 3:** the agent outlives the window (`--parent-pid` isn't passed), and keeps polling and printing with its agent key after the app closes and after sign-out | `boot.rs` 16, `Program.cs` 70–73 | 9.1, 10.1; design doc decision 10 |
| **Rev 3:** sign-out revokes refresh tokens, which signs the same login out on every PC | `auth.service.ts` 261 | 5.1: revoke only with `allDevices` |
| **Rev 3:** the registration ID token is minted before the claims are set | `auth.service.ts` 189, 207 | 4.7: refresh after setting claims |
| **Rev 3:** there's no lease expiry; a job claimed by an agent that dies before queuing it stays DISPATCHING forever, and no UI can rescue it | `print-job.service.ts` 263–277 | 6.3: re-delivery in `sync`; retry from stuck DISPATCHING |
| **Rev 3:** an accept replay queues a second set of jobs; manual dispatch can create duplicate jobs for a document; a shredded document can still be dispatched | accept route 20–22; `print-job.service.ts` 484–624, 893–929 | 4.3, 6.3, 6.5 |
| **Rev 3:** retry with a new printer keeps the old `agentId` and system printer name | `print-job.service.ts` 871 | 6.3 |
| **Rev 3:** payment confirmation isn't idempotent by state; a new key rewrites the payment reference | `confirmOnlinePayment` | 6.2 |
| **Rev 3:** local cancel isn't reported to the cloud except by the sweep | `jobs.cancel` handler | 10.5 |
| **Rev 3:** the guest cookie is the raw `printUserId` | `print-user-http.ts` 25 | 6.8 (signed cookie, P3-02) |
| **Rev 3:** local-storage download links are signed with the client-visible `FIREBASE_WEB_API_KEY` (local backend only) | `document.service.ts` 58 | Separate ticket: use a server-only secret |
| **Security, found while building Phase 1:** `apps/server/.env` and `apps/server/.env.local` are tracked in git and hold the Firebase service-account private key and the S3 secret key. Next.js also loads both files in production builds. | `git ls-files apps/server` | Separate ticket, urgent: rotate both credentials, untrack the files, add `.env*` (except `.env.example`) to `apps/server/.gitignore`, and set the values only in App Hosting secrets. `apps/server/docs/auth.md` wrongly says `.env.local` is gitignored. |
| Shredding marks `shreddedAt` but never deletes the storage object | `confirmDocumentShredded` | P2-01 |
| Files of rejected or cancelled orders are never deleted | — | P2-01 (maintenance) |
| `retryPrintJob` keeps the old lease and timestamps | `print-job.service.ts` about 869 | P2-01 |
| A failure to set claims at registration is only logged | `auth.service.ts` 206–214 | P1-03 |
| The agent downloads files with a 20 s timeout shared with API calls | `AgentCloudSynchronizer.cs` | P2-04 |
| The desktop date filter compares UTC dates | `dashboard.ts` `filterOrders` | P2-06 (server computes shop-time days) |
| Rule drafts allow client writes and use `exists()` | `packages/firebase/docs/firestore.rules`, MBP copy | P1-01 |
| Index drafts reference fields that are never written | `packages/firebase/docs/firestore.indexes.json` | P1-02 |
| The guest order response returns the full `OrderDto` | `getGuestOrder` | P3-01 |
| The tracking UI maps FAILED and PRINT_FAILED, which the server never sets | `mapServerStatus` | P3-01 |
| `packages/firebase/.env.example` contains a real-looking Web API key | — | Separate ticket: use a placeholder and restrict the key |
| The bridge never reconnects after the agent process dies | `bridge.rs` | Out of scope |
| No CI runs the server or web app checks | `.github/workflows` | Optional, with P1-01 |

---

## 17. Docs to update

Done in P2-07, except where noted.

| Doc | What changes |
| --- | --- |
| [`PRINT_SHOP_DESKTOP.md`](./PRINT_SHOP_DESKTOP.md) | Status line; line 45 ("Detached single-instance process" → exits with the app); §1 ("agent independently polls" → wakes on the doorbell); §2 (REST + SSE → REST + agent doorbell); §4 methods and commands tables plus the polling paragraph; §9 auth (the agent owns token refresh; no heartbeat) |
| [`Order_to_Print_Execution_Runbook.md`](../developer-requirement/desktop-app/Order_to_Print_Execution_Runbook.md) | "Shipped flow" steps 5 and 7 (doorbell → `sync` → report outbox); credentials (the agent holds the user's refresh token and ID token, no agent key); point to the new agent tests (10.6). None exist for the synchronizer today. |
| `apps/print-shop/AGENTS.md` | Line 16: replace "server-mediated SSE" with the board from `board?since=` on `board.changed`; "no Firebase SDK" stays true. Line 60 (login) stays. |
| `apps/print-agent/AGENTS.md` | Line 87 (device-scoped credential, becomes the user's ID token) and the sync-loop rules at 88–93 (doorbell-driven `sync`, report outbox, de-duplication by job and lease). Line 18 (refresh token: now also used by the agent), line 19 (detached: now exits with the app) and line 33 (tests list). Line 79 ("no Firebase SDK") stays true; note that the doorbell is plain HTTPS. |
| [`apps/server/docs/auth.md`](../../apps/server/docs/auth.md) | Claims-based principal (P1-03) |
| [`apps/server/docs/print-user.md`](../../apps/server/docs/print-user.md) | Signed cookie, `firebaseToken`, tracking copy (P3-02) |
| [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md) | Remove the SSE section; `minInstances: 0`; `FIREBASE_DATABASE_URL`, `PRINT_USER_COOKIE_SECRET`; client Firebase env (P3-03) |
| [`packages/firebase/docs/`](../../packages/firebase/docs/) | Point to the real rules and indexes; document `createCustomToken` and `getServiceAccessToken` (P1-01) |
| [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](./DESKTOP_TRAFFIC_SCALING_PLAN.md) | Spike results: **done** in version 2.2. Still to do: P0-03 results, and mark phases done as they land. |
| This document | Fill in the 3.3 table (P0-03) |

---

## 18. Out of scope

- A live "online now" indicator (design doc 9.1).
- Running the agent as a Windows service, or keeping it running after the app closes (design doc 9.2 and decision 10).
- Firestore listeners in the desktop window while visible (design doc 9.3).
- Moving print jobs to `shops/{shopId}/printJobs` (design doc 9.4).
- Removing the web app proxy (design doc 8.4).
- Staff-management routes. When built, they follow 4.7.
- A real payment gateway.
- Reconnecting the Rust bridge after an agent crash.
