# Traffic scaling v2: implementation plan

> **Status:** Draft for engineering review, revision 2, 15 Oct 2026. No code has been written.
> **Revision 2:** the minimized-window test failed. A minimized WebView2 window doesn't deliver Firestore listener updates reliably. Everything time-critical now runs in the agent, which listens to a Realtime Database "doorbell" over its documented REST stream. The desktop window has no Firebase SDK.
> **Design:** [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](./DESKTOP_TRAFFIC_SCALING_PLAN.md) (version 2.1) explains *why*. This document covers *what changes where, in what order, and how we know it works*.
> **Components:** `apps/server`, `apps/print-shop` (Tauri UI and Rust bridge), `apps/print-agent` (C#), `apps/printUserWebapp`, `packages/firebase`, `packages/schemas`, `packages/types`, Firebase project config.
> **Baseline:** current `main`. File and line references were taken on 15 Oct 2026 and will drift.

---

## How to review this

Check these first. Each one is expensive to change once Phase 2 starts.

1. **The doorbell spike (section 3).** It proves that a plain HTTPS event stream to Realtime Database stays up on real shop networks, and measures its bandwidth.
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
                 Print agent (Windows process; not throttled)
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
| **Server: auth** | `ShopPrincipal`, local `verifyIdToken` | `requireShopUser` → `requireShopPrincipal`; registration fails if claims can't be set | Per-request `lookupIdToken` and `authLookups` reads |
| **Server: realtime (new module)** | `ringShop` (doorbell ring helper) | Called after commits in order, job and payment paths | — |
| **Server: orders** | `orderTracking` copy, `searchKeys`, `completedDocumentIds`, single order-write helper, history and search endpoints | Lifecycle times; server-timestamp `updatedAt`; transitions idempotent by status; payment confirm no longer auto-accepts; accept takes `agentId` | `statusHistory`, transition idempotency docs, SSE stream, the old full `GET /orders` |
| **Server: print jobs** | `syncAgent` (auto-accept and claim), `reportAgentJobs`, `board` endpoint, storage delete on COMPLETED | Routing prefers the caller's PC; retry clears the lease | Agent jobs list and fallback; per-job claim, PATCH, document and shred routes; job `PRINTING` |
| **Server: devices** | `/devices/offline` marks this PC's printers OFFLINE | `registerShopDevice` issues no credential | Heartbeat route, `markStaleAgentsOffline`, `requireAgentCredential`, `apiKeyHash` |
| **Server: print-user** | Signed session cookie; `firebaseToken` on session start | Read the session once per request; shop config cached 60 s | Per-minute session touch writes |
| **Desktop UI** | `board.ts` (initial and delta), `order-history.ts`, visibility handling | API token comes from the agent; boot, login and sign-out; Orders screen data source; connection badge | Heartbeat, SSE client, full order list, token state, agent-credential hand-off |
| **Rust bridge** | `notify()` (one-way frame), `agent_notify` and `agent_get_id_token` commands, native notifications (`tauri-plugin-notification`), `agent:ready` event | — | `set_agent_cloud_credential` |
| **Print agent** | `FirebaseTokenManager`, `DoorbellClient` (SSE, watchdog, polling fallback), `AgentSyncService`, `ReportOutbox`, handlers for `cloud.*` and `sync.request` | SQLite gains report-state and shop columns; separate download client | Poll loop, per-job routes, agent API key and its Credential Manager entry |
| **Customer web app** | Lazy Firebase module, tracking listener, "shop hasn't confirmed" state | Session and cart reuse between pages; one quote | 6 s tracking poll, dead tracking and payment code |
| **Hosting** | `FIREBASE_DATABASE_URL`, `PRINT_USER_COOKIE_SECRET` | `minInstances: 0` | — |

---

## 3. Spikes

### 3.1 Minimized-window test: failed (recorded)

Firestore listener updates aren't delivered reliably to a minimized WebView2 window. The design was revised so that:

- the web view does nothing time-critical;
- the agent holds the realtime connection;
- native notifications come from the Rust side.

### 3.2 Doorbell spike (P0-02, 1 day)

**Goal:** prove that a Realtime Database REST stream stays up from shop PCs, and measure latency and bandwidth.

**Setup** (throwaway project in `spikes/`, not shipped):

1. A test Firebase project with a Realtime Database in `asia-southeast1`, the rules from 7.2, and a test user with claim `shopId: "spike"`.
2. A C# console app (.NET 8) that:
   - turns a stored refresh token into an ID token with the Secure Token API;
   - opens `GET {databaseUrl}/doorbell/spike.json?auth=<idToken>` with `Accept: text/event-stream`;
   - logs every event with a timestamp.
3. A ring script (Node) that `PATCH`es the doorbell with a service-account token every 10–120 s at random, logging the write time.

**Measure** (Windows 10 and 11, on networks like the shops'):

| Item | Pass |
| --- | --- |
| Ring → event latency | p95 under 500 ms; no missed values (the last value always arrives) |
| Keep-alive interval | Recorded; it sets the watchdog |
| Bytes per connection-hour (Realtime Database usage page) | 25 KB or less (that keeps 1,000 PCs × 12 h/day under about 9 GB/month) |
| Token expiry | `auth_revoked` arrives at about 60 minutes; refresh and reconnect within 5 s; the first `put` carries the latest value |
| 307 redirect | `HttpClient` follows it, including on reconnect |
| Network cut 2 and 40 minutes; Windows sleep and resume | Reconnects within 30 s of the network returning |
| Broadband, mobile hotspot, a network with antivirus HTTPS scanning (common in shops), a corporate proxy if available | Events arrive unbuffered. Any network that buffers or blocks is noted. |

**Outcome:**

- **Pass:** proceed.
- **Some networks buffer or block the stream:** keep the design, and rely on the agent's polling fallback there (10.3): a 60 s `GET` of the doorbell value, costing Realtime Database bandwidth only.
- **Realtime Database unusable everywhere:** stop and revisit the design.

---

## 4. Data model

Paths as today unless marked **new**.

### 4.1 `shops/{shopId}/orders/{orderId}`

| Field | Change | Notes |
| --- | --- | --- |
| `status` | unchanged values | SUBMITTED, SHOP_ACCEPTED, PRINTING, READY, COMPLETED, REJECTED, CANCELLED |
| `lifecycle` | **extended** | Existing: `submittedAt`, `acceptedAt`, `acceptedByUserId`, `readyAt`, `completedAt`, `completedByUserId`. Add: `printingAt`, `rejectedAt`, `cancelledAt`, `paidAt`. Replaces `statusHistory`. |
| `updatedAt` | **server timestamp, always** | `FieldValue.serverTimestamp()` on create and on every write. `board?since=` depends on it. |
| `createdAt` | check type | Must be a `Timestamp` for range queries; change the writer if it's an ISO string today |
| `completedDocumentIds` | **new**, `string[]` | Added with `arrayUnion` by reports. READY when it covers every `documents[].id`. |
| `searchKeys` | **new**, `string[]` | Lowercased: order number, pickup code, phone digits, filename words of 3 or more letters. At most about 40. |
| `statusHistory/*` | **removed** | Writes at `order.service.ts` 375, 557, 626, 819; reads in `readHistory` (240) |

**Single writer.** Every order write goes through `applyOrderChange(transaction, orderRef, current, change)`. It:

1. checks the transition;
2. sets `status`, the matching `lifecycle.*At`, and `updatedAt` (server timestamp);
3. writes the tracking copy (4.2) when a customer-visible field changed;
4. skips no-op writes;
5. returns a `ring` hint (6.9).

Writers to route through it: `transitionOrder`, `acceptShopOrder`, `rejectShopOrder`, `markShopOrderPrinting`, `markShopOrderReady`, `completeShopOrder`, `cancelShopOrder`, `recordCashPayment`, `confirmOnlinePayment`, and the sync and report paths.

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
| `status` | **`PRINTING` removed.** QUEUED → DISPATCHING → COMPLETED / FAILED / CANCELLED; FAILED → QUEUED on retry |
| `leaseId`, `claimedAt` | Set by claim (in `sync`), **cleared** by retry |
| `updatedAt` | **Server timestamp, always.** Used by `board?since=` for jobs. |
| `pagesPrinted`, `spoolerJobId`, `errorCode`, `errorMessage`, `completedAt` | Set by the final report |

Idempotency documents for claim, update and retry are removed: the lease and the status precondition make them idempotent. Dispatch keeps its key.

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
- **Route audit (36 route files):** produce a table of route → fields used, attached to the PR. Routes that need `name`, `email` or `phone` read the user document; `/api/auth/me` returns the full user.

### 5.2 The PC's login is owned by the agent

The refresh token already lives in Windows Credential Manager (`Ctrlp.PrintShop/refreshToken`), written through the agent. The agent now also **uses** it.

**Agent token manager:**

- **Endpoint:** `POST https://securetoken.googleapis.com/v1/token?key=<firebaseApiKey>` with form `grant_type=refresh_token&refresh_token=…`. The response has `id_token`, `refresh_token`, `expires_in` and `user_id`. This is the documented Firebase Auth REST call; our server already uses it in `refreshIdToken`.
- **When it refreshes:** at 55 of 60 minutes, on an `auth_revoked` stream event, and on a 401 from our API (once). Only one refresh runs at a time.
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
- **Sign-out:**
  1. `POST /api/auth/logout` (revokes refresh tokens).
  2. `POST /devices/offline`.
  3. `cloud.clear`: the agent stops the stream, forgets the token, and holds pending reports.
  4. `secrets.clearRefreshToken`.
- **`POST /api/auth/refresh`** stays on the server for other clients; the desktop no longer calls it.

**API key:** the desktop needs only the Firebase Web API key and the database URL; it doesn't need a registered Firebase web app. Restrict the key in Google Cloud to the Identity Toolkit and Token Service APIs.

### 5.3 Agent calls to the API

- The agent sends `Authorization: Bearer <idToken>`.
- Inside each transaction, the server checks `principal.shopId == job.shopId` (or the order's shop) and `job.agentId == path agentId`.
- Removed: `requireAgentCredential`, the headers `x-ctrlp-agent-key` / `x-ctrlp-agent-id`, `apiKeyHash`, `secrets.setAgentCloudCredential`, and the Credential Manager entry `Ctrlp.PrintShop/agentCloud`.

### 5.4 Customers

- `POST /api/v1/public/shops/{slug}/session` also returns `firebaseToken = createCustomToken(printUserId)`.
- The tracking page signs in with it and reads `orderTracking/{orderId}` where `printUserId == auth.uid`. No custom claims are needed.
- With Identity Platform, each guest who signs in counts as a monthly active user (50 k free).

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
- Registration: claims required (4.7).
- `logoutShopUser`: take the uid from the verified token.
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
  - **remove auto-accept** (about line 802);
  - set `payment.status`, `payment.reference`, `lifecycle.paidAt`;
  - callers (webhook, `mockConfirmGuestPayment`) **remove `queueIncomingOrder`** and ring `order_paid` (work + board).
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
3. **After commit:**
   - sign a download URL for each claimed job (`createPresignedDownloadUrl`, 15 min, signed locally);
   - ring the board once if anything changed;
   - also ring work if step 1 queued jobs for **other** agents.
4. **Output:** `{ accepted: [orderId], claimed: [{ orderId, jobId, documentId, leaseId, resolvedSettings, printerSystemName, printerName, pagesTotal, download: { url, sha256Hash, mimeType, pageCount, expiresIn } }], more }`. `more` is true when either query hit its limit.

**`reportAgentJobs(principal, agentId, input)`**, route `POST .../agents/{agentId}/jobs/report`:

- **Input:** `{ reports: [{ orderId, jobId, leaseId, status: COMPLETED | FAILED | CANCELLED, pagesPrinted?, spoolerJobId?, errorCode?, errorMessage? }] }`, at most 20.
- **For each report, one transaction:**
  1. Read the job and the order.
  2. If the job is already in the reported status with the same lease, it's a replay: continue to step 5.
  3. If the lease doesn't match, report `lease_mismatch`. If the job isn't DISPATCHING, report `invalid_state`.
  4. Otherwise set the final status and fields. On COMPLETED, `arrayUnion(documentId)` into `completedDocumentIds`. If that now covers every document and the order is PRINTING, `applyOrderChange` to READY.
  5. **After commit, on COMPLETED:** `deleteObject(storageKey)`, then set `documents[i].shreddedAt`. If the delete fails, report `retry`.
- **Ring the board once per request.**
- **Output:** `{ results: [{ jobId, result: ok | retry | lease_mismatch | invalid_state | not_found }] }` with HTTP 200. HTTP 5xx only when the whole request failed.

**Change:**

- `retryPrintJob`: clear `leaseId`, `claimedAt` and `startedAt`; increment `retryCount`; ring work.
- `routePrintJob(…, { preferAgentId })`: among capable, enabled, ONLINE printers, prefer the agent, then default, then fewest `activeSpoolJobs`.
- `dispatchPrintJob` (manual): ring work.
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
  - A replay on an already accepted order returns 200 and doesn't queue again.

### 6.6 Devices

- **Delete:** the heartbeat route, `recordDeviceHeartbeat`, `markStaleAgentsOffline`, `HEARTBEAT_INTERVAL_SECONDS`, and `deviceHeartbeatRequestSchema`.
- **`registerShopDevice`:** no credential issuance. Writes `{ id, shopId, hostname, osVersion, appVersion, agentVersion, registeredByUserId, lastActiveAt, updatedAt }`. Returns `{ deviceId }`.
- **`markDeviceOffline`:** also sets this agent's printers OFFLINE (one batch).

### 6.7 `lastActiveAt`

`touchAgentActivity` runs on `register`, `accept` (with `agentId`), `sync` and `report`. At most every 10 minutes per agent and instance; one `update` with no read; best effort.

### 6.8 Guest API (print-user)

**Signed cookie.** The value is `v1.<printUserId>.<expiresAtEpochSeconds>.<ipHash>.<hmac>`, with HMAC-SHA256 using the new secret `PRINT_USER_COOKIE_SECRET`.

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
- **Timeout and retry:** 2 s timeout; one retry after 200 ms; then a structured log (`ring_failed`, shopId, event). It never throws.
- **Awaited before the response is sent,** because Cloud Run takes CPU away after the response.
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
5. Server env: `FIREBASE_DATABASE_URL` (plain) and `PRINT_USER_COOKIE_SECRET` (secret), in `apps/server/apphosting.yaml` and `docs/deployment.md`.
6. Budget alerts (12.3).

---

## 8. Desktop UI (`apps/print-shop`)

There's no Firebase dependency in the desktop. `App.tsx` keeps owning state, and new logic goes into small modules under `src/lib/`. The pure parts are tested with Vitest.

### 8.1 Config

- **Env:** add `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_DATABASE_URL`, passed to the agent in `cloud.configure`. Add them to `.env.example` and type them in `vite-env.d.ts`.

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
  2. `logoutSession`.
  3. `agentNotify("cloud.clear")`.
  4. `clearStoredRefreshToken`.
- **Window close:** `onCloseRequested` calls `markDeviceOffline` with a 2 s timeout, then closes (best effort).
- **On `agent:ready`** (agent restarted): send `cloud.configure` and `cloud.session` again.

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
- **Nudge:** if the board shows a QUEUED job for this PC's agent older than 60 s, send `sync.request` to the agent, at most once a minute.

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
  - the stream-state references (989, 1168, 1210);
  - `idToken` state.
- **`cloud.ts`:**
  - `sendDeviceHeartbeat`, `listShopOrders` (old full list), `parseOrderStreamMessage`, `streamShopOrders`;
  - `updateOrderPrintJob`, `markDocumentShredded`;
  - `refreshSession` usage at boot.
- **`agent.ts`:** `storeAgentCloudCredential`.
- **`orders.ts`:** the SSE event types; keep the reducer, adapted to `BOARD_*`.
- **Tests:** the SSE-parser tests in `orders.test.ts` become board-merge tests.

---

## 9. Pipe protocol and Rust bridge

### 9.1 Rust (`src-tauri/src/agent/bridge.rs`, `commands.rs`, `lib.rs`, `capabilities/default.json`)

- **`AgentBridge::notify(method, params)`:**
  - writes a JSON-RPC frame **without `id`**, using the writer but not `call_lock`;
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
- **Remove** `set_agent_cloud_credential`.
- **Known limit, not in scope:** the bridge never reconnects after the agent process dies. The UI shows the agent failed until restart.
- **One call at a time:** the bridge serialises calls (`call_lock`). `cloud.getIdToken` returns a cached token in milliseconds; a refresh (about hourly) takes about 0.2–1 s.

### 9.2 Messages

| Direction | Method | Kind | Params / result | When |
| --- | --- | --- | --- | --- |
| UI → agent | `cloud.configure` | notification | `{ serverBaseUrl, firebaseApiKey, databaseUrl }` | Boot and `agent:ready` |
| UI → agent | `cloud.session` | notification | `{ shopId, agentId, idToken?, expiresAt? }` | After login or boot device registration; `agent:ready` |
| UI → agent | `cloud.clear` | notification | `{}` | Sign-out |
| UI → agent | `sync.request` | notification | `{}` | The board's stale-queue nudge; Settings "Sync now" |
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
  - the worker's job-event callback writes to the outbox instead of calling `ReportAsync`.
- **Remove:** the `agentCloud` credential from `WindowsCredentialStore`, `ISecretStore`, `MemorySecretStore`, and the `AgentCloudCredential` record.

### 10.2 `FirebaseTokenManager` (new, `Core/Cloud/`)

- **Inputs:** `firebaseApiKey` (from `cloud.configure`) and the refresh token from `ISecretStore`.
- **State:** `{ idToken, expiresAt, claims }`, held in memory only.
- **Refresh** with the Secure Token API (5.2): single-flight; scheduled at 55 minutes while signed in; on demand on a 401 or `auth_revoked`. Store a rotated refresh token.
- **Failure:** an HTTP 400 from Google (`TOKEN_EXPIRED`, `USER_DISABLED`, `INVALID_REFRESH_TOKEN`) sets `token: invalid` and stops the doorbell. Network errors retry with backoff (1 s doubling to 60 s).
- **`cloud.session` with `idToken`** seeds the cache, so there's no refresh straight after login.
- **`cloud.clear`:** forget everything in memory. The refresh token is cleared by the UI's `secrets.clearRefreshToken`.

### 10.3 `DoorbellClient` (new)

**Stream:**

- Request: `GET {databaseUrl}/doorbell/{shopId}.json?auth=<idToken>`, with `Accept: text/event-stream`, `HttpCompletionOption.ResponseHeadersRead` and an infinite timeout. Follow 307s (`HttpClient` does by default).
- An SSE parser handles `event:` and `data:` lines, multi-line data, CRLF and comments. Unit-tested.

| Event | Action |
| --- | --- |
| `put` (path `/`) | Replace the cached value |
| `patch` | Merge keys |
| `keep-alive` | Reset the watchdog |
| `cancel` | Rules denied the read: log, set `doorbell: offline`, ask the token manager to force a refresh, reconnect once |
| `auth_revoked` | Refresh the token, then reconnect |

**After each value change:**

- `workAt` greater than the last handled → `AgentSyncService.Signal()`. In-memory `lastWorkAt` starts at 0, so the first value after any start syncs once.
- `boardAt` changed → notify `board.changed`.
- `last` changed with type `order_submitted` or `order_paid`, and `(type, orderId)` not in the last 50 seen → notify `orders.attention`.

**Staying connected:**

- **Watchdog:** reconnect if no event arrives for 2× the keep-alive interval measured in the spike.
- **Reconnect** at once after a clean end. After failures: 1 s doubling to 60 s, with jitter.
- **Polling fallback:** 5 failed connects within 10 minutes switches to polling `GET {databaseUrl}/doorbell/{shopId}.json?auth=` every 60 s for 30 minutes, then tries the stream again. `cloud.state.doorbell = "polling"`.
- **On `cloud.clear`, sign-out, or no session:** close the stream.

### 10.4 `AgentSyncService` (replaces the poll loop in `AgentCloudSynchronizer`)

- **Trigger:** a coalescing signal (`Channel` with capacity 1 and drop-write). Sources: the doorbell `workAt`, `sync.request`, and a new session.
- **Loop:** wait for the signal → `POST .../agents/{agentId}/sync` → for each claimed job:
  1. Download with a **separate download client** (5 min timeout) to `{stagingRoot}/{jobId}/document.{ext}`.
  2. Verify SHA-256.
  3. `Enqueue` locally with `CloudOrderId`, `CloudDocumentId`, `LeaseId`, `CloudShopId`, `CloudAgentId`.
  4. On a staging failure, outbox a FAILED report with `AGENT_STAGING_FAILED`.
- **Repeat at once while `more`.** Publish `cloud.state.lastSyncAt`.
- **Skip** jobs already in SQLite with the same `cloud_job_id` and a non-terminal state (de-duplication).
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
3. **Doorbell client:** reconnects after a drop; the watchdog fires; `auth_revoked` → refresh → reconnect; 5 failures → polling → back to streaming; a newer `workAt` signals sync exactly once per change; attention de-duplication.
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
  - the poll (78–106), `pollLatestOrderStatus`, `POLLING_INTERVAL_MS`;
  - the FAILED and PRINT_FAILED mappings;
  - the dead code `createFromSubmittedOrder`, `createDemoOrder`, `getRealDocumentsFromSession`, `getCachedOrderTracking`, `saveCachedOrderTracking`;
  - the simulator bar and `transitionOrderStatus`.

### 11.2 Fewer guest API calls

- **Cart reuse:** a module-level store holds the last `GuestSessionDto`, updated by every cart-changing response. The upload page restore (`s/[slug]/page.tsx` 106), the customize reconcile (`customize/page.tsx` 106) and `loadOrderDraft` (`order-repository.ts` 144) use it, and call `GET /public/session` only on a hard load.
- **One quote:**
  - remove the quote in `initiateOnlinePaymentTransaction` (`payment-repository.ts` 56);
  - debounce the quote after review edits (`use-review-order.ts` 182) by 500 ms;
  - delete `refreshPriceAuthoritatively`.
- **Dead code:** `src/hooks/use-payment.ts` and the redirect-only payment page logic.

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
  - doorbell bytes within the spike's measured budget (Realtime Database usage).

### 12.3 Budget and usage alerts

- **Cloud Billing budget:** for example $5/month, alerting at 50%, 90% and 100%.
- **Cloud Monitoring:**
  - Firestore reads above 40,000/day;
  - writes above 16,000/day;
  - Cloud Run requests above 50,000/day;
  - Realtime Database sent bytes on pace for more than 7 GB/month.
- **Log-based metric** on `ring_failed`; alert above 10 an hour.

---

## 13. Work breakdown

Estimates are for one engineer who knows the code. Dependencies are by task ID.

### Phase 0: gate

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P0-01 | Firebase project setup: `firebase.json`, `.firebaserc`, Realtime Database in `asia-southeast1`, web app registration, key restrictions, env values (7.1, 7.5) | — | 0.5 d | All three emulators start; config values recorded |
| P0-02 | Doorbell spike (3.2) | P0-01 | 1 d | Results table filled in this doc; keep-alive interval and bytes/hour recorded; go/no-go decided |

### Phase 1: foundation (server, rules, model)

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P1-01 | Firestore and Realtime Database rules, with tests (7.2, 7.3) | P0-01 | 1 d | All tests in 7.3 pass |
| P1-02 | Indexes file and deploy (7.4) | P0-01 | 0.25 d | Indexes built in staging |
| P1-03 | `ShopPrincipal` auth, claims required, route audit (5.1, 6.1) | — | 1 d | No `lookupIdToken` on request paths; audit table in the PR |
| P1-04 | Guest `firebaseToken` on session start (5.4) | P1-03 | 0.25 d | The emulator can sign in with it |
| P1-05 | `applyOrderChange`, lifecycle, drop `statusHistory`, transitions by status, server-timestamp `updatedAt` on orders and jobs, `searchKeys`, `completedDocumentIds`, tracking copy (4.1–4.3, 6.2) | — | 2 d | Every writer uses the helper; unit tests for transitions and the copy |
| P1-06 | `ringShop` and every call site in the ring table; `FIREBASE_DATABASE_URL` (6.9) | P1-05, P0-01 | 0.75 d | Rings visible in the emulator for each event; failures logged, never thrown |
| P1-07 | Op counters and budget alerts (12.1, 12.3) | — | 0.5 d | Log lines in staging; alerts configured |
| **Phase 1** | | | **5.75 d** | |

### Phase 2: agent-driven delivery

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P2-01 | Server `sync` and `report`, retry lease fix, routing preference, accept `agentId`, remove server auto-accept, `devices/offline` printers, `lastActiveAt`, maintenance job (6.3, 6.5–6.7, 6.10) | P1-03, P1-05, P1-06 | 2.5 d | Unit tests (auto-accept race, claim, leases, replays, READY, shred retry); old agent routes deleted |
| P2-02 | Server `board`, history and search endpoints (6.4) | P1-05 | 1 d | Delta correctness tests (overlap, duplicate removal, caps, left-active-set) |
| P2-03 | Agent `FirebaseTokenManager` and `DoorbellClient`, with the polling fallback and tests (10.2, 10.3) | P0-02 | 2 d | Tests 10.6 #1–3 pass; runs against staging for 3 hours without leaks |
| P2-04 | Agent `AgentSyncService`, `ReportOutbox`, SQLite migration, download client, with tests (10.4–10.6) | P2-01, P2-03 | 2 d | Tests 10.6 #4–6 pass; end-to-end print in staging |
| P2-05 | Rust `notify`, commands, native notifications, `agent:ready`; C# protocol and handlers (9, 10.1) | — | 0.75 d | Notifications arrive; a toast shows while minimized; handler latency test passes |
| P2-06 | Desktop: token from the agent, boot, login and sign-out, board client with visibility, connection badge, history and search, stale-queue nudge (8.2–8.6) | P2-02, P2-05 | 1.5 d | Orders screen works with no stream; board-merge tests pass |
| P2-07 | Removals (8.7, 6.6) and docs (section 17) | P2-04, P2-06 | 0.5 d | Grep finds none of the removed symbols; docs updated |
| **Phase 2** | | | **10.25 d** | |

### Phase 3: customer side and trims

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P3-01 | Tracking listener, guest sign-in, fallback, "not confirmed" state, dead code (11.1) | P1-01, P1-04, P1-05 | 1.5 d | Live tracking with 0 API requests after load |
| P3-02 | Signed cookie, read-once, config cache, cart reuse, one quote (6.8, 11.2) | — | 1.5 d | Per-order counts within ±20% of the model |
| P3-03 | `minInstances: 0`, `deployment.md`, staging cost and idle runs (12.2) | P2-07 | 0.5 d | Cost check and idle check pass |
| **Phase 3** | | | **3.5 d** | |

**Total: about 21 days** (Phase 0: 1.5, Phase 1: 5.75, Phase 2: 10.25, Phase 3: 3.5).

**Paths through the work:**

- **Critical path:** P0-01 → P0-02 → P2-03 → P2-04 → end to end.
- **Server line:** P1-03 → P1-05 → P1-06 → P2-01 → P2-02.
- **UI line:** P2-05 → P2-06.
- **Two engineers** (server and rules; desktop and agent) finish in about 2.5 weeks.

**Release order** (no existing users): indexes → rules (both databases) → server → desktop installer → web app.

---

## 14. Test plan

### 14.1 Unit

| Area | Cases |
| --- | --- |
| Server: auth | Valid token and claims → principal; missing claims → 401; expired → 401; wrong shop → 403 |
| Server: orders | Transition table (replay → no write; wrong state → 409); lifecycle times; tracking copy only for guest orders and only on visible changes; server-timestamp `updatedAt`; `searchKeys` |
| Server: sync | Auto-accept only when enabled and paid; a race between two agents → one accept; queued jobs prefer the caller; claim only this agent's QUEUED jobs; `more`; ring decisions |
| Server: report | Replay `ok`; `lease_mismatch`; `invalid_state`; READY after the last document (also with duplicate jobs); a failed delete → `retry`; retry clears the lease |
| Server: board | Full versus delta; 5 s overlap; caps → full; left-active-set; jobs by `updatedAt` |
| Server: ring | Body shape; awaited; one retry; never throws; coalesced per request |
| Server: guest | Cookie sign and verify, expiry, IP mismatch, tampering; config cache |
| Desktop (Vitest) | Board merging (snapshot, delta, duplicates, moving out of active tabs); visible-only fetch with a dirty flag; stale-queue nudge; shop-time date parameters |
| Agent (xUnit) | 10.6 |
| Rules | 7.3 |

### 14.2 End to end (staging, real Windows PCs)

| # | Scenario | Expected |
| --- | --- | --- |
| E1 | ONLINE order, 2 files, window visible | Auto-accepted by `sync`; claimed; printed; READY. Payment → claim p95 under 2 s (warm). |
| E2 | Same, window **minimized for 1 hour** beforehand | Same timings. A native toast "New order" appears. |
| E3 | CASH order while minimized | Native toast; the operator restores the window, sees it on the board, accepts; printed; READY; cash; COMPLETED |
| E4 | App closed when a paid order arrives | The order stays SUBMITTED; the customer sees "hasn't confirmed" after 10 minutes. App opened → first doorbell value → `sync` → accepted and printed. |
| E5 | Job fails → operator retries | FAILED → QUEUED (new lease); the stale report is rejected; prints on retry |
| E6 | Network cut for 2 minutes during printing | The report is queued, then sent; no duplicate print; the doorbell reconnects |
| E7 | Network cut for 40 minutes; Windows sleep and resume | The doorbell reconnects; the first value triggers `sync`; nothing missed |
| E8 | Session longer than 3 hours | Hourly `auth_revoked` → refresh → reconnect; no 401s on the API |
| E9 | Two PCs, one paid order | One accept wins; jobs go to the winner's printers; the other PC claims nothing |
| E10 | Sign out, then a different shop signs in on the same PC | Doorbell switches shop; reports for the first shop are held |
| E11 | Stream blocked on a test network | Polling fallback within 10 minutes; jobs still arrive within about 60 s |
| E12 | Customer tracking from payment to handover | Live updates; 0 API requests after load; fallback works with Firestore blocked |
| E13 | Idle PC for 1 hour | 0 API requests; 0 Firestore reads; doorbell bytes within budget |
| E14 | A ring fails (inject an error) | The next ring, reconnect or "Sync now" catches up; `ring_failed` is logged |

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
~60 min: Realtime Database sends auth_revoked → agent: Secure Token API → new idToken → reopen stream
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
| A minimized WebView2 window doesn't deliver listener updates; Tauri's throttling switch is WebKit-only | Spike 3.1 | This revision (agent-held doorbell) |
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
| [`PRINT_SHOP_DESKTOP.md`](./PRINT_SHOP_DESKTOP.md) | Status line; §1 ("agent independently polls" → wakes on the doorbell); §2 (REST + SSE → REST + agent doorbell); §4 methods and commands tables plus the polling paragraph; §9 auth (the agent owns token refresh; no heartbeat) |
| [`Order_to_Print_Execution_Runbook.md`](../developer-requirement/desktop-app/Order_to_Print_Execution_Runbook.md) | "Shipped flow" steps 5 and 7 (doorbell → `sync` → report outbox); credentials (the agent holds the user's refresh token and ID token, no agent key); synchronizer tests now exist |
| `apps/print-shop/AGENTS.md` | Line 60: no SSE; the board comes from `board?since=` on `board.changed`. Line 16 ("no Firebase SDK") stays true. |
| `apps/print-agent/AGENTS.md` | Sync-loop rules at 87–92 (doorbell-driven `sync`, report outbox). Line 79 ("no Firebase SDK") stays true; note that the doorbell is plain HTTPS. |
| [`apps/server/docs/auth.md`](../../apps/server/docs/auth.md) | Claims-based principal (P1-03) |
| [`apps/server/docs/print-user.md`](../../apps/server/docs/print-user.md) | Signed cookie, `firebaseToken`, tracking copy (P3-02) |
| [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md) | Remove the SSE section; `minInstances: 0`; `FIREBASE_DATABASE_URL`, `PRINT_USER_COOKIE_SECRET`; client Firebase env (P3-03) |
| [`packages/firebase/docs/`](../../packages/firebase/docs/) | Point to the real rules and indexes; document `createCustomToken` and `getServiceAccessToken` (P1-01) |
| [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](./DESKTOP_TRAFFIC_SCALING_PLAN.md) | Spike results (P0-02); mark phases done |

---

## 18. Out of scope

- A live "online now" indicator (design doc 9.1).
- Running the agent as a Windows service (design doc 9.2).
- Firestore listeners in the desktop window while visible (design doc 9.3).
- Moving print jobs to `shops/{shopId}/printJobs` (design doc 9.4).
- Removing the web app proxy (design doc 8.4).
- Staff-management routes. When built, they follow 4.7.
- A real payment gateway.
- Reconnecting the Rust bridge after an agent crash.
