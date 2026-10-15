# Traffic scaling v2: implementation plan

> **Status:** Draft for engineering review, 15 Oct 2026. No code has been written.
> **Design:** [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](./DESKTOP_TRAFFIC_SCALING_PLAN.md) (version 2) explains *why*. This document covers *what changes where, in what order, and how we know it works*.
> **Components:** `apps/server`, `apps/print-shop` (Tauri UI and Rust bridge), `apps/print-agent` (C#), `apps/printUserWebapp`, `packages/firebase`, `packages/schemas`, `packages/types`, Firebase project config.
> **Baseline:** current `main`. File and line references were taken on 15 Oct 2026 and will drift.

---

## How to review this

Check these first. Each one is a decision that is expensive to change once Phase 2 starts.

1. **The spike runs first (section 3).** If a minimized WebView2 window delays Firestore listener updates, the jobs listener moves into the agent (fallback F2), which affects tasks P2-04 and P2-07.
2. **Auth (section 5).** Shop users are identified by Firebase claims, the desktop SDK keeps its login in memory only, and the agent uses the desktop user's token instead of its own API key.
3. **Data model (section 4).** `statusHistory` is dropped, a new `orderTracking` collection is added for customers, `completedDocumentIds` decides READY, and the job `PRINTING` state is removed.
4. **Contracts (section 6).** The batch `claim` and `report` endpoints, and the routes being deleted.
5. **Auto-accept moves to the desktop (section 6.5).** This changes behaviour: paid orders wait while no PC is running.
6. **Work breakdown and estimates (section 13).**

Things found in the code that should be fixed regardless of this plan are in section 16.

---

## Contents

1. [Architecture](#1-architecture)
2. [Component change map](#2-component-change-map)
3. [Step zero: the minimized-window spike](#3-step-zero-the-minimized-window-spike)
4. [Data model](#4-data-model)
5. [Authentication](#5-authentication)
6. [Server](#6-server)
7. [Firestore rules, indexes and project config](#7-firestore-rules-indexes-and-project-config)
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
                          writes (Admin SDK, transactions)
 Customer web app ─┐
 Desktop UI ───────┼──▶ API on Cloud Run ────────────────────▶ Firestore
 Print agent ──────┘    (stateless, minInstances 0)                │
                                                                   │ snapshot listeners
                                                                   │ (Google-hosted; billed per changed doc)
                   ┌───────────────────────────────────────────────┤
                   ▼                                               ▼
         Desktop UI (Tauri WebView2)                  Customer tracking page
          • shops/{s}/orders  where status in live set     • orderTracking/{orderId}
          • printJobs (collection group) where shopId,
            status in unfinished set
                   │
                   │ named pipe (JSON-RPC notifications)
                   │   cloud.session, cloud.clear, jobs.available
                   ▼
            Print agent ── POST jobs/claim, POST jobs/report ──▶ API
                   │
                   └── GET presigned URL ──▶ Railway storage
```

**Rules that hold everywhere**

- No client sends anything on a timer through the API. Listeners carry change notifications.
- Clients only **read** Firestore, and only what the rules in section 7 allow. Every write goes through the API.
- The API holds no state between requests. In-memory caches are optional speed-ups for a warm instance; nothing depends on them.
- The agent acts on the **current set** of queued jobs, sent again on every snapshot. A missed event can't strand a job.

---

## 2. Component change map

| Component | Add | Change | Remove |
| --- | --- | --- | --- |
| **Firebase project** | `firebase.json`, `.firebaserc`, deployed rules and indexes, two registered web apps (desktop, customer), budget alerts | — | Rule and index drafts in `packages/firebase/docs/` (moved, rewritten) |
| **`packages/firebase`** | `firestore.rules`, `firestore.indexes.json`, rules tests, `createCustomToken` helper, optional op counters | — | — |
| **`packages/schemas` / `types`** | Claim/report schemas, `ShopPrincipal`, `cloud.session` and `jobs.available` shapes | Auth response gets `firebaseCustomToken`; session response gets `firebaseToken` | Heartbeat schema, per-job PATCH/claim schemas |
| **Server: auth** | `ShopPrincipal`, local `verifyIdToken`, custom-token minting | `requireShopUser` → `requireShopPrincipal`; registration fails if claims can't be set | Per-request `lookupIdToken` and `authLookups` reads |
| **Server: orders** | `orderTracking` projection, `searchKeys`, `completedDocumentIds`, single order-write helper | Lifecycle times on every status change; transitions idempotent by status; payment confirm no longer auto-accepts; accept takes `agentId` | `statusHistory` writes and reads, transition idempotency docs, SSE stream, `GET /orders` list |
| **Server: print jobs** | `claimAgentJobs`, `reportAgentJobs`, storage delete on COMPLETED | `routePrintJob` prefers the accepting PC; `retryPrintJob` clears the lease | `listAgentPrintJobs` and fallback, per-job claim/PATCH/document/shred routes, job `PRINTING` |
| **Server: devices** | `/devices/offline` marks this PC's printers OFFLINE | `registerShopDevice` issues no credential | Heartbeat route, `markStaleAgentsOffline`, `requireAgentCredential`, `apiKeyHash` |
| **Server: print-user** | Signed session cookie, `firebaseToken` on session start | Read the session once per request; shop config cached 60 s | Per-minute session touch writes |
| **Desktop UI** | `firebase.ts`, `live-orders.ts`, `live-jobs.ts`, `order-history.ts`, `auto-accept.ts` | Login/boot (custom token), Orders screen data source, connection badge, Settings copy | Heartbeat effect, SSE client, `listShopOrders` call, agent-credential hand-off |
| **Rust bridge** | `notify()` (one-way frame), `agent_notify` command | — | `set_agent_cloud_credential` command |
| **Print agent** | `cloud.session` / `cloud.clear` / `jobs.available` handlers, wake channel, report outbox | Synchronizer becomes event-driven; SQLite gains report-state columns; separate download client | Poll loop, per-job routes, agent API key and its Credential Manager entry |
| **Customer web app** | Lazy Firebase module, tracking listener, "shop hasn't confirmed" state | Session/cart reuse between pages; one quote | 6 s tracking poll, dead tracking/payment code |
| **Hosting** | — | `minInstances: 0` | — |

---

## 3. Step zero: the minimized-window spike

**Why first:** shops will keep the app minimized or behind other windows. Tauri's background-throttling switch covers only WebKit (macOS/Linux), not WebView2 on Windows. If WebView2 delays listener callbacks while minimized, the jobs listener must run in the agent instead. That changes P2-04 and P2-07.

**Setup** (throwaway branch, about 1 day):

1. A test Firebase project with the rules from section 7, plus a test user with claims.
2. A minimal page in the Tauri shell that signs in with a custom token and listens to a test `printJobs` query, logging a timestamp for each snapshot.
3. A script that writes job documents every 30–120 s from another machine.

**Measure** (Windows 10 and 11, real shop-like PCs):

| Case | Pass |
| --- | --- |
| Window focused | p95 under 1 s from write to callback |
| Minimized for 5, 30 and 60 minutes | p95 under 2 s, no missed writes |
| Covered by other windows, screen locked | Same as minimized |
| Network dropped for 2 min while minimized, then restored | All writes delivered within 30 s of restore |
| Laptop sleep and resume | Delivered within 30 s of resume. Acceptable: sleeping PCs don't print anyway. |

**Outcome:**

- **Pass:** proceed as written.
- **Fail:** adopt fallback F2:
  - the agent opens the jobs listener itself with `Google.Cloud.Firestore`, using the user's ID token as a bearer credential;
  - the spike must then also prove that this authenticates under the security rules;
  - `apps/print-agent/AGENTS.md` currently forbids a Firebase SDK in the agent, and that rule would change.

---

## 4. Data model

Paths as today unless marked **new**.

### 4.1 `shops/{shopId}/orders/{orderId}`

| Field | Change | Notes |
| --- | --- | --- |
| `status` | unchanged values | SUBMITTED, SHOP_ACCEPTED, PRINTING, READY, COMPLETED, REJECTED, CANCELLED |
| `lifecycle` | **extended** | Existing: `submittedAt`, `acceptedAt`, `acceptedByUserId`, `readyAt`, `completedAt`, `completedByUserId`. Add: `printingAt`, `rejectedAt`, `cancelledAt`, `paidAt`. Every status change sets its timestamp. Replaces `statusHistory`. |
| `completedDocumentIds` | **new**, `string[]` | Document IDs with a COMPLETED job. Written with `arrayUnion` by the report. READY when it covers every `documents[].id`. Replaces the sibling-job read. |
| `searchKeys` | **new**, `string[]` | Lowercased: order number, pickup code, phone digits (if any), filename words of 3 or more letters. Written at creation. At most about 40 entries. |
| `printUserId` | unchanged | Already written by `createPrintUserOrder`. Copied to the tracking projection. |
| `createdAt` | check type | Must be a Firestore `Timestamp` for the history date-range queries. If it's an ISO string today, change the writer (no existing data). |
| `statusHistory/*` subcollection | **removed** | Writes at `order.service.ts` 375, 557, 626, 819; reads in `readHistory` (240) |

**Single writer.** Every order write goes through one helper, `applyOrderChange(transaction, orderRef, current, change)`. It:

1. checks the transition;
2. sets `status`, the matching `lifecycle.*At`, and `updatedAt`;
3. writes the tracking projection (4.2) when a customer-visible field changed;
4. skips the write entirely when nothing changed.

Today's writers to route through it: `transitionOrder`, `acceptShopOrder`, `rejectShopOrder`, `markShopOrderPrinting`, `markShopOrderReady`, `completeShopOrder`, `cancelShopOrder`, `recordCashPayment`, `confirmOnlinePayment`, and the job claim/report.

**Why it matters for cost:** every write to an active order costs one read for each listening desktop and customer. The helper refuses no-op writes and never touches `updatedAt` alone.

### 4.2 `orderTracking/{orderId}` (new)

A customer-safe copy of the order, the only order data a guest can read. Firestore rules work per document, not per field, so the guest can't be pointed at the real order without also seeing:

- staff user IDs;
- payment references and cash fields;
- storage keys and hashes.

| Field | Source |
| --- | --- |
| `orderId`, `shopId`, `printUserId` | order |
| `orderNumber`, `pickupCode`, `status` | order |
| `payment` | `{ method, status }` only |
| `totalPaise` | `amounts.total` |
| `items[]` | `{ name, pageCount, billablePages, copies, colorMode, paperSize, totalPaise, mimeType }` from `documents[]` |
| `rejectionReason` | `rejection.reason` |
| `times` | `{ submittedAt, paidAt, acceptedAt, printingAt, readyAt, completedAt, rejectedAt, cancelledAt }` |
| `updatedAt` | — |

- **Written:** in the same transaction as the order, by `applyOrderChange`, only for guest orders (`createPrintUserOrder`) and only when one of these fields changes. About 6 writes per order.
- **Never written** for shop-created orders (`createShopOrder`, `createPdfOrder`, `createSinglePagePrintOrder`).
- **Deleted:** 30 days after a terminal status, by the daily maintenance job (6.9).

### 4.3 `shops/{shopId}/orders/{orderId}/printJobs/{jobId}`

| Field | Change |
| --- | --- |
| `status` | **`PRINTING` removed.** The states are now QUEUED → DISPATCHING → COMPLETED / FAILED / CANCELLED, and FAILED → QUEUED on retry. Local printing progress stays in the agent and reaches the UI over the pipe. |
| `leaseId`, `claimedAt` | Set by claim. **Cleared** by retry (bug today: `retryPrintJob` leaves them). |
| `pagesPrinted`, `spoolerJobId`, `errorCode`, `errorMessage`, `completedAt` | Set by the final report |
| `shopId`, `agentId`, `orderId`, `documentId` | unchanged; required by the rules and listener queries |

Job idempotency documents for claim, update and retry (`print-job.service.ts` 726, 828, 880) are removed. The lease (`leaseId`) and the status precondition make claim and report idempotent. Dispatch keeps its idempotency key, because a user starts it.

### 4.4 `shops/{shopId}/agents/{agentId}`

- `apiKeyHash` is removed, and no credential is issued.
- `status` and `lastSeenAt` are replaced by `lastActiveAt`, written at register and at most every 10 minutes on requests the PC already makes (6.7). Nothing reads it for decisions; it's for admin views.

### 4.5 `shops/{shopId}/printers/{printerId}`

Unchanged fields. Two behaviour changes:

- `/devices/offline` sets `status: OFFLINE` on every printer with this `agentId`.
- Routing prefers printers whose `agentId` matches the accepting PC (6.5).

### 4.6 `printUsers/{printUserId}`

- `lastSeenAt` touch writes are removed. The signed cookie carries expiry (6.8).
- `expiresAt` is still written on create and on cart changes. The resume-by-IP query still uses it.

### 4.7 Shop users (Firebase Auth)

Custom claims `{ shopId, shopUserId, role }` are already set at registration (`auth.service.ts` 206–214), but a failure is only logged. **Make it required:** if setting claims fails, roll back the registration as other failures do. There are no staff-management routes yet. When they're built, they must set claims and, on deactivation, disable the user and revoke refresh tokens.

---

## 5. Authentication

### 5.1 Shop users on the API

| Today | After |
| --- | --- |
| `requireShopUser(idToken)`: `lookupIdToken` (an HTTPS call to Google), then 2 reads (`authLookups`, user doc), returning `AuthSessionUser` | `requireShopPrincipal(request)`: `getFirebaseAuth().verifyIdToken(token)`, checked locally against cached Google keys, returning `ShopPrincipal { uid, shopId, shopUserId, role }` from claims. **0 network calls, 0 reads.** |

- **Missing claims** → 401 `CLAIMS_MISSING`. There are no existing users, so no fallback lookup.
- **Revocation checks** (`verifyIdToken(token, true)`, one call to Google) on `logout` and, once they exist, staff-management routes.
- **Disabled or deactivated users:** their refresh fails within 1 hour. Existing ID tokens work until they expire (at most 1 hour).
- **Route audit (36 route files):** most routes use only `shopId` and `id`. Routes that need `name`, `email` or `phone` read the user document themselves. `/api/auth/me` keeps returning the full `AuthSessionUser`, from the user document. The audit produces a table of route → fields used, attached to the PR.
- **Error mapping:** `mapFirebaseAdminError` already maps expired, revoked and invalid tokens to 401.

### 5.2 Desktop sign-in and the Firebase SDK

- **Login** (`POST /api/auth/login`) returns, as today, `{ user, tokens: { idToken, refreshToken, expiresIn } }`, **plus `firebaseCustomToken`** from `createCustomToken(uid)`. It's signed locally with the service-account key, with no network call.
- **The desktop SDK keeps its login in memory only** (`initializeAuth` with `inMemoryPersistence`). Firebase tokens are never written to WebView2 storage.
- **The long-lived secret stays where it is:** the server-issued `refreshToken` in Windows Credential Manager (`Ctrlp.PrintShop/refreshToken`, through the agent).
- **On app start:** stored refresh token → `POST /api/auth/refresh` → returns `firebaseCustomToken` too → `signInWithCustomToken`. One request per start.
- **After sign-in:** every API call uses `await auth.currentUser.getIdToken()`. The SDK refreshes the ID token itself, which removes the expired-token storm.
- **On sign-out:** `POST /api/auth/logout` (revokes), `signOut`, terminate Firestore, and **clear its local cache**, so the next shop on a shared PC doesn't see cached orders. The UI also sends `cloud.clear` to the agent.

### 5.3 Agent

- **No agent credential anymore.** The UI sends `cloud.session { serverBaseUrl, shopId, agentId, idToken, expiresAt }`:
  - after sign-in;
  - on every `onIdTokenChanged`;
  - whenever the bridge becomes ready.
- **The agent keeps the token in memory only,** and sends it as `Authorization: Bearer`.
- **About to expire, or a 401:** the agent emits the notification `cloud.tokenRequired` to the UI. The UI calls `getIdToken(true)` and answers with a fresh `cloud.session`. The agent waits up to 30 s, then retries once.
- **Server checks** for claim and report, inside the transaction: `principal.shopId == job.shopId` and `job.agentId == path agentId`. A staff token can act for any PC in its own shop, which is the same trust boundary as the signed-in desktop.
- **Removed:** `requireAgentCredential`, the headers `x-ctrlp-agent-key` / `x-ctrlp-agent-id`, `apiKeyHash`, `secrets.setAgentCloudCredential`, and the Credential Manager entry `Ctrlp.PrintShop/agentCloud`.

### 5.4 Customers

- `POST /api/v1/public/shops/{slug}/session` also returns `firebaseToken` = `createCustomToken(printUserId)`, where the uid is the guest session UUID.
- Only the tracking page uses it (11.1), to read `orderTracking/{orderId}` where `printUserId == auth.uid`.
- The rule doesn't rely on custom claims in the token.
- If the project ever moves to Identity Platform, each guest who signs in counts as a monthly active user (50 k free).

---

## 6. Server

Paths under `apps/server/` unless noted.

### 6.1 Auth module

**Where:**

- `src/modules/auth/auth.service.ts`
- `src/modules/auth/require-request.ts`
- `src/modules/orders/order-http.ts` (`runShopOrder`)
- `src/modules/shops/shop-route.ts` (`withOwnShop`)
- `packages/firebase/src/auth.ts`
- `packages/types/src/auth.ts`

**Tasks:**

- Add `requireShopPrincipal`. Rewire `readAuthorizedShopUser`, `runShopOrder` and `withOwnShop` to it, keeping the `shopId` match check.
- `registerShopOwner`: setting claims becomes required (4.7).
- `loginShopUser` and `refreshShopUserSession`: add `firebaseCustomToken`. Refresh no longer needs `lookupIdToken` when `user_id` is present; it already is.
- `logoutShopUser`: take the uid from the verified token, not from `lookupIdToken`.
- Export `createCustomToken` from `packages/firebase` (a thin wrapper around `getFirebaseAuth().createCustomToken`).
- Keep `lookupIdToken` in `auth-rest.ts` for now, unused in request paths. Delete it once nothing imports it.

### 6.2 Orders module

**Where:** `src/modules/orders/order.service.ts`, routes under `app/api/v1/shops/[shopId]/orders/**`.

**Tasks:**

- Add `applyOrderChange` (4.1) and move every order writer onto it.
- `transitionOrder`:
  - drop the idempotency-key read and write;
  - if `current.status` is already the target, return the order without writing (a replay);
  - if it's neither the expected source nor the target, return 409.
- `readHistory`: delete it and the `history` parameter of `toOrderDto`.
- `createPrintUserOrder`: write `searchKeys`, `completedDocumentIds: []` and the tracking projection. Keep the submit idempotency key.
- `createShopOrder`: write `searchKeys` and `completedDocumentIds: []`.
- `confirmOnlinePayment`:
  - **remove auto-accept** (the `autoAccepted` branch at about line 802);
  - set `payment.status = PAID`, `lifecycle.paidAt`, `payment.reference`;
  - always return `{ order, autoAccepted: false }` until callers are updated, then drop the field.
- Webhook (`app/api/v1/internal/payments/.../confirmed/route.ts`) and `mockConfirmGuestPayment` (`print-user.service.ts` about 454): remove the `queueIncomingOrder` calls.
- **Delete:**
  - `subscribeShopOrders` and `orders/stream/route.ts`;
  - the GET handler in `orders/route.ts` (keep POST);
  - `listShopOrders`.

### 6.3 Print-jobs module

**Where:** `src/modules/printing/print-job.service.ts`, new routes under `app/api/v1/shops/[shopId]/agents/[agentId]/jobs/`.

**Add `claimAgentJobs(principal, agentId, input)`**, route `POST .../agents/{agentId}/jobs/claim`:

- **Input:** `{ jobs?: [{ orderId, jobId }] }`, at most 10.
- **Without `jobs`:** run the collection-group query `printJobs` where `shopId`, `agentId`, `status == QUEUED`, ordered by `createdAt`, limit 10. Used for recovery and fallback F2.
- **One transaction:**
  1. read the listed jobs and their distinct orders;
  2. for each job still QUEUED for this agent: set DISPATCHING, a new `leaseId` and `claimedAt`;
  3. for each order still SHOP_ACCEPTED: `applyOrderChange` to PRINTING.
- **After commit:** sign a download URL for each claimed job (`createPresignedDownloadUrl`, 15 min; local signing, no network).
- **Output:**
  - `claimed`: the job details plus `{ leaseId, download: { url, sha256Hash, mimeType, pageCount, expiresIn } }` for each claimed job;
  - `skipped`: `{ orderId, jobId, reason: "not_queued" | "not_found" | "other_agent" }` for the rest.

**Add `reportAgentJobs(principal, agentId, input)`**, route `POST .../agents/{agentId}/jobs/report`:

- **Input:** `{ reports: [{ orderId, jobId, leaseId, status: "COMPLETED" | "FAILED" | "CANCELLED", pagesPrinted?, spoolerJobId?, errorCode?, errorMessage? }] }`, at most 20.
- **For each report, in its own transaction:**
  1. Read the job and the order.
  2. If the job is already in the reported status with the same `leaseId`, treat it as a replay: report `ok` and continue to step 5.
  3. If `leaseId` doesn't match, report `lease_mismatch`. If the job isn't DISPATCHING, report `invalid_state`.
  4. Otherwise set the final status and fields. On COMPLETED, `arrayUnion` the `documentId` into `completedDocumentIds`. If that now covers every document and the order is PRINTING, `applyOrderChange` to READY.
  5. **After commit, on COMPLETED:** `deleteObject(document.storageKey)`, then set `documents[i].shreddedAt` (a non-visible field: no projection write). If the delete fails, report `retry` for that job. The agent resends it, and the replay path in step 2 reaches step 5 again.
- **Output:** `{ results: [{ jobId, result: "ok" | "retry" | "lease_mismatch" | "invalid_state" | "not_found" }] }` with HTTP 200.
  - HTTP 5xx only when the whole request failed.
  - `ok` and the three permanent results acknowledge the report on the agent. `retry` keeps it queued.

**Change:**

- `retryPrintJob`: FAILED → QUEUED; clear `leaseId`, `claimedAt` and `startedAt`; increment `retryCount`.
- `routePrintJob(…, { preferAgentId })`: among capable, enabled, ONLINE printers, prefer `agentId == preferAgentId`, then default, then fewest `activeSpoolJobs`.
- `queueIncomingOrder(order, { preferAgentId })`: pass the preference through.
- `assertJobTransition`: remove PRINTING. DISPATCHING → COMPLETED, FAILED or CANCELLED.

**Delete:**

- `listAgentPrintJobs`, `listQueuedJobsByCollectionGroup`, `listQueuedJobsFromActiveOrders`, `claimPrintJob`;
- routes: `agents/[agentId]/jobs` (GET), `orders/[orderId]/jobs/[jobId]/claim`, `orders/[orderId]/jobs/[jobId]` (PATCH), `orders/[orderId]/jobs/[jobId]/document`, `orders/[orderId]/documents/[docId]/shred`;
- `confirmDocumentShredded` in `document.service.ts`, replaced by the report.

`updatePrintJob`: no client uses it after this (the desktop's `updateOrderPrintJob` is unused), so delete it with its route.

### 6.4 Desktop-facing order routes kept

- **Unchanged contracts:** `accept`, `reject`, `ready`, `complete`, `cancel`, `cash`, `jobs` (GET list and POST dispatch), `jobs/[jobId]/retry`, `documents/[docId]/download-url`, `routing`, `printers/**`, `automation`, `pricing`, `hours`, `capabilities`, `profile`, `staff`.
- **`printing` route:** with the claim setting PRINTING, the manual `printing` route is only needed for manual workflows. Keep it.

### 6.5 Accept and auto-accept

- **`POST .../orders/{orderId}/accept`** body: `{ agentId? }`, the calling PC's agent.
  - If `autoDispatchAcceptedOrders` is on, call `queueIncomingOrder(order, { preferAgentId: agentId })`.
  - A replay on an already accepted order returns 200 with the order and doesn't queue again (6.2).
- **The server no longer auto-accepts.** The desktop does (8.5):
  - **Behaviour:** a paid ONLINE order stays `SUBMITTED` (and paid) until a desktop that's running accepts it.
  - **If two PCs race,** one wins and the other gets the replay response.

### 6.6 Removed device routes

- **Delete:**
  - `app/api/v1/devices/heartbeat/route.ts`, `recordDeviceHeartbeat`, `markStaleAgentsOffline`;
  - `HEARTBEAT_INTERVAL_SECONDS` and `heartbeatIntervalSeconds` in responses;
  - `deviceHeartbeatRequestSchema`.
- **`registerShopDevice`:**
  - no credential issuance;
  - writes `{ id, shopId, hostname, osVersion, appVersion, agentVersion, registeredByUserId, lastActiveAt, updatedAt }`;
  - returns `{ deviceId }`.
- **`markDeviceOffline`:** also batch-updates this agent's printers to `status: OFFLINE`.

### 6.7 `lastActiveAt`

`touchAgentActivity(shopId, agentId)` runs, at most every 10 minutes per agent and per instance, on:

- `devices/register`;
- `accept`;
- `jobs/claim`;
- `jobs/report`.

It's one `update` with no read. It's best effort: a missed write is fine.

### 6.8 Guest API (print-user)

**Where:**

- `src/modules/print-user/print-user-http.ts`
- `print-user-session.service.ts`
- `print-user.helpers.ts`
- `print-user.service.ts`
- `src/modules/shops/shop-config.service.ts`

**Signed cookie.** The value is `v1.<printUserId>.<expiresAtEpochSeconds>.<ipHash>.<hmac>`:

- `ipHash` is the first 16 hex characters of SHA-256 of the client IP;
- `hmac` is HMAC-SHA256 over the rest, using the new secret `PRINT_USER_COOKIE_SECRET`.

`requirePrintUserSession` then:

- verifies the signature, expiry and IP hash, and returns `{ printUserId }` with **no read**;
- re-issues the cookie with a fresh expiry at most once an hour (sliding).

Routes that need the session's contents read the document themselves, once.

**Other tasks:**

- `completeGuestDocument`: read the session once, then the transaction (today it's 3 reads of the same document).
- Remove `touchSession` and `shouldTouchSession`.
- Session start (`createOrResumePrintUserSession`): return `firebaseToken` (5.4). Stop returning `ipAddress` and document `storageKey`s in the session DTO; the client doesn't use them.
- `getShopConfig`: in-memory cache per instance, 60 s TTL, invalidated on that instance's own writes. Other instances may serve old prices for up to 60 s. Submit already re-quotes and returns `priceChanged`.
- Keep `GET /api/v1/public/session/orders/{orderId}` as a one-shot fallback for the tracking page (11.1). Stop it reading `statusHistory` (that's gone anyway) and trim its response to the projection's fields.

### 6.9 Daily maintenance (Cloud Scheduler)

`POST /api/v1/internal/maintenance/daily` is protected by a shared-secret header, as the payment webhook is. Cloud Scheduler calls it once a day; scheduler free tier: 3 jobs/month.

It:

1. Deletes `orderTracking` documents for orders that have been terminal for more than 30 days.
2. Deletes expired `printUsers` sessions and their leftover storage objects.
3. Deletes storage objects for documents of REJECTED or CANCELLED orders that are older than 1 day (a privacy gap today; see section 16).

Cost: 1 request a day, plus reads proportional to what's deleted.

### 6.10 Schemas and types

**`packages/schemas`:**

- **Add:**
  - `claimAgentJobsRequestSchema`, `claimAgentJobsResponseSchema`;
  - `reportAgentJobsRequestSchema`, `reportAgentJobsResponseSchema`;
  - `acceptOrderRequestSchema` (`{ agentId? }`);
  - `cloudSessionSchema`, `jobsAvailableSchema` (shared shapes for the pipe, mirrored in C#).
- **Change:** `authSessionResponseSchema` adds `firebaseCustomToken`.
- **Remove:**
  - `deviceHeartbeatRequestSchema`;
  - `updatePrintJobRequestSchema`, `claimPrintJobRequestSchema`, `claimAgentPrintJobsRequestSchema`, if unused after the deletions.

**`packages/types`:** add `ShopPrincipal`.

---

## 7. Firestore rules, indexes and project config

### 7.1 Files

| File | Purpose |
| --- | --- |
| `firebase.json` (repo root, new) | Points to the rules and indexes; emulator ports for Firestore (8080) and Auth (9099) |
| `.firebaserc` (new) | Project aliases, for example `staging` and `prod` |
| `packages/firebase/firestore.rules` (new) | Rules below. Replaces the drafts in `packages/firebase/docs/` and `docs/desktop app feature MBP/`; delete those or mark them historical. |
| `packages/firebase/firestore.indexes.json` (new) | Indexes below |
| `packages/firebase/test/rules.test.ts` (new) | Rules tests with `@firebase/rules-unit-testing` against the emulator |
| root `package.json` | `firebase-tools` as a dev dependency; scripts `firebase:rules:test` and `firebase:deploy:rules` |

### 7.2 Rules (allow and deny table)

Clients never write. The Admin SDK on the server bypasses rules. Every condition uses only `request.auth` and `resource.data`, with no `get()` or `exists()`, so rule checks cost no reads.

| Path | Operation | Allowed when |
| --- | --- | --- |
| `shops/{shopId}/orders/{orderId}` | `get`, `list` | `request.auth.token.shopId == shopId` |
| `{path=**}/printJobs/{jobId}` (collection group, and any order's jobs) | `get`, `list` | `resource.data.shopId == request.auth.token.shopId`. Queries must filter `shopId ==`. |
| `orderTracking/{orderId}` | `get` | `request.auth != null && resource.data.printUserId == request.auth.uid` |
| `orderTracking/{orderId}` | `list` | never |
| everything else | any | never |

Shop data the desktop needs elsewhere (printers, config, staff) keeps coming from the API. Those calls are rare and user-driven.

### 7.3 Rules tests (minimum)

**Allowed:**

- A shop A user can list A's live orders.
- A shop A user can query `printJobs` with `shopId == A`.
- A guest can get their own tracking document.

**Denied:**

- A shop A user reading shop B's orders or jobs.
- A `printJobs` query without a `shopId` filter.
- A guest getting another guest's tracking document.
- A guest reading any order document.
- Listing `orderTracking`.
- Any client write anywhere.
- Unauthenticated reads.

### 7.4 Indexes

| Collection | Scope | Fields | Used by |
| --- | --- | --- | --- |
| `printJobs` | Collection group | `shopId` ASC, `status` ASC | Desktop jobs listener |
| `printJobs` | Collection group | `shopId` ASC, `agentId` ASC, `status` ASC, `createdAt` ASC | Claim without a job list |
| `orders` | Collection | `status` ASC, `createdAt` DESC | Completed and All tabs with a status filter |
| `orders` | Collection | `searchKeys` ARRAY_CONTAINS, `createdAt` DESC | Search |
| `printUsers` | Collection | `shopId` ASC, `ipAddress` ASC | Session resume (an existing query; check whether it needs a composite) |

- The live board's `status in [...]` on one collection uses the automatic single-field index.
- Drop the draft indexes that don't match real fields, such as `lifecycle.createdAt` and `printJobs.priority`.

### 7.5 Project setup checklist

1. Register two Firebase web apps, `print-shop-desktop` and `print-user-web`. Record each one's `apiKey`, `authDomain`, `projectId` and `appId`.
2. Restrict the browser API key(s) in Google Cloud to:
   - the Identity Toolkit, Token Service and Firestore APIs;
   - the customer domain as an HTTP referrer for the web key.
3. Deploy indexes before the code that queries them: `firebase deploy --only firestore:indexes`, then wait until they're built.
4. Deploy rules: `firebase deploy --only firestore:rules`.
5. Budget alerts (12.3).

---

## 8. Desktop UI (`apps/print-shop`)

`App.tsx` owns all state today (1,259 lines). New logic goes into small modules under `src/lib/`, which `App.tsx` wires together. The pure parts are unit-tested with Vitest.

### 8.1 New dependency and config

- `firebase`: the modular SDK, pinned to an exact version.
- Env:
  - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`;
  - add them to `.env.example` and type them in `vite-env.d.ts`.
- `tauri.conf.json` has `"csp": null` today, so nothing blocks Google domains. If a CSP is added later, it must allow `firestore.googleapis.com`, `identitytoolkit.googleapis.com` and `securetoken.googleapis.com`.

### 8.2 `src/lib/firebase.ts` (new)

- **Initialise once:**
  - `initializeApp(config)`;
  - `initializeAuth(app, { persistence: inMemoryPersistence })`;
  - `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) })`.
- **Exports:**
  - `startFirebaseSession(customToken)`;
  - `getApiToken()`, which wraps `getIdToken()`;
  - `onTokenChange(cb)`;
  - `endFirebaseSession()`: `signOut`, `terminate`, `clearIndexedDbPersistence`;
  - `connectionState$`, derived from snapshot metadata `fromCache` (8.4).

### 8.3 Login, boot and sign-out (`App.tsx`)

- **`handleLogin` / `handleRegister`:** after the API response, `startFirebaseSession(firebaseCustomToken)`, then `connectDevice` as today, minus the credential hand-off.
- **`restoreSession`:** stored refresh token → `refreshSession` (now returns `firebaseCustomToken`) → `startFirebaseSession`.
- **`request()` in `cloud.ts`:** get the bearer token from `getApiToken()` instead of the `idToken` state.
  - Remove `idToken` from effect dependencies, so token refreshes don't restart anything.
  - On a 401, call `getIdToken(true)` once and retry once. Return to the login screen if that fails.
- **`onTokenChange`:** send `cloud.session` to the agent (9.2).
- **`handleSignOut`:**
  1. `markDeviceOffline` (also marks printers OFFLINE);
  2. `logoutSession`;
  3. `agentNotify("cloud.clear")`;
  4. `endFirebaseSession()`;
  5. `clearStoredRefreshToken`.
- **Window close:** register `onCloseRequested`. Call `markDeviceOffline` with a 2 s timeout, then close (best effort).
- **`connectDevice`:** remove `storeAgentCloudCredential` and `beatOnce`.

### 8.4 Live data

**`src/lib/live-orders.ts` (new)**

- **Query:** `shops/{shopId}/orders` where `status in [SUBMITTED, SHOP_ACCEPTED, PRINTING, READY]`.
- **Feeds the existing `OrderStore` through the existing `reduceOrderEvent`,** so the screens don't change:
  - the first non-cache snapshot → `ORDERS_SNAPSHOT`;
  - a later `added` → `ORDER_CREATED`;
  - `modified` → `ORDER_STATUS_CHANGED`;
  - `removed` → new event `ORDER_LEFT_LIVE`, which removes the order from the live store (it was completed, rejected or cancelled; the Completed tab queries it fresh).
- **Notifications:**
  - "New order" only for `added` changes in snapshots that aren't from the cache (`!metadata.fromCache`), so a restart doesn't re-announce cached orders.
  - Optional: `metadata.hasPendingWrites` can be ignored, since the desktop never writes.
- **Mapping:** convert `Timestamp` fields to ISO strings, matching `ShopOrder` in `protocol.ts`.

**`src/lib/live-jobs.ts` (new)**

- **Query:** collection group `printJobs` where `shopId ==` and `status in [QUEUED, DISPATCHING, FAILED]`.
- **Feeds `jobsByOrderId`** through `PRINT_JOB_CHANGED`, as today. A job that leaves the set is updated from the change's last data, and its final state is fetched with the order's jobs when the order details open.
- **Agent wake:** `queuedForAgent(snapshot, agentId)` returns `[{ orderId, jobId }]` for QUEUED jobs with `agentId == this PC's agentId`. When the list is non-empty, send it as `jobs.available` (9.2). Also send it on every bridge ready event. This is a pure function, unit-tested.
- **Connection badge:** `fromCache: true` on the latest snapshot means offline. It replaces the heartbeat-driven `cloud` state in `App.tsx` and the "Order stream: …" label.

**Order details:** on open, one query of `shops/{s}/orders/{o}/printJobs` (all statuses), replacing `listOrderPrintJobs`. `refreshSelectedOrder` reads the order from the live store, or with one `getDoc` if it isn't live.

### 8.5 `src/lib/auto-accept.ts` (new)

`ordersToAutoAccept(liveOrders, automation, inFlight)` returns the orders that are:

- `SUBMITTED`;
- `payment.method == ONLINE` and `payment.status == PAID`;
- under `automation.autoAcceptPaidOnline == true`;
- not already in flight.

`App.tsx` calls `accept({ agentId })` for each, and adds the ID to an in-flight set that's cleared on response.

- A 409 or replay response is ignored.
- The function is pure and unit-tested.

### 8.6 `src/lib/order-history.ts` (new)

Paged queries replace in-memory filtering of the full history (`filterOrders` keeps working on whatever is loaded):

| View | Query |
| --- | --- |
| Completed tab | `status in [COMPLETED, REJECTED, CANCELLED]`, `orderBy createdAt desc`, limit 50, "Load more" with `startAfter` |
| All tab | `orderBy createdAt desc`, limit 50 |
| Date picker | `createdAt >= start && < end` of the chosen day **in Asia/Kolkata**, fixing the UTC bug in `filterOrders`; the live set merged in |
| Search | `searchKeys array-contains <term>`, `orderBy createdAt desc`, limit 50, for terms of 3 or more characters, lowercased |
| Payment filter | Applied in memory to the loaded page |

Queries run only when the view opens or the user asks for more. New, Active and Ready come from the live store.

### 8.7 Removals

- **`App.tsx`:**
  - the heartbeat effect (353–371) and `beatOnce`;
  - the stream effect (334–351);
  - `lastHeartbeatAt`;
  - the stream-state references (989, 1168, 1210).
- **`cloud.ts`:**
  - `sendDeviceHeartbeat`, `listShopOrders`, `parseOrderStreamMessage`, `streamShopOrders`;
  - `updateOrderPrintJob`, `markDocumentShredded` (both unused);
  - the `listOrderPrintJobs` usage.
- **`agent.ts`:** `storeAgentCloudCredential`.
- **`SettingsScreen.tsx`:** `lastHeartbeatAt` and `streamState` props become "Live updates: connected/offline".
- **Tests:** the SSE-parser tests in `orders.test.ts` are replaced by mapping tests for the snapshot adapters.

---

## 9. Pipe protocol and Rust bridge

### 9.1 Rust (`src-tauri/src/agent/bridge.rs`, `commands.rs`, `lib.rs`)

- **Add `AgentBridge::notify(method, params)`:**
  - writes a JSON-RPC frame **without `id`** through the existing writer;
  - doesn't take `call_lock`, so it isn't blocked behind a slow call;
  - fails silently when the bridge isn't ready (the UI re-sends on ready).
- **Add the command `agent_notify(method, params)`,** restricted to the allowlist `cloud.session`, `cloud.clear` and `jobs.available`. Add `cloud.session` to the redaction list.
- **Emit a Tauri event `agent:ready`** when the bridge becomes ready, so the UI re-sends `cloud.session` and `jobs.available`.
- **Remove the command `set_agent_cloud_credential`.**
- **Known limit, not in scope:** the bridge never reconnects after the agent process dies; the state stays `Failed` until the app restarts. Keep that as is, but log it clearly.

### 9.2 Messages

| Direction | Method | Params | When |
| --- | --- | --- | --- |
| UI → agent | `cloud.session` | `{ serverBaseUrl, shopId, agentId, idToken, expiresAt }` | After sign-in, on every token change, on `agent:ready`, in reply to `cloud.tokenRequired` |
| UI → agent | `cloud.clear` | `{}` | Sign-out |
| UI → agent | `jobs.available` | `{ jobs: [{ orderId, jobId }] }` (at most 50) | Every jobs snapshot with QUEUED jobs for this agent; on `agent:ready` |
| Agent → UI | `cloud.tokenRequired` | `{ reason: "expiring" \| "unauthorized" }` | Token within 5 min of expiry when about to call the API, or a 401 |
| Agent → UI | `cloud.state` | `{ state: "idle" \| "claiming" \| "reporting" \| "error", pendingReports, lastError? }` | On change; shown in Settings diagnostics |

All three UI → agent messages are notifications: no reply, idempotent, and safe to repeat.

---

## 10. Print agent (`apps/print-agent`)

### 10.1 Protocol and handlers

- **`Contracts/Protocol/Protocol.cs`:**
  - add `cloud.session`, `cloud.clear` and `jobs.available` to `RpcMethods`;
  - add `cloud.tokenRequired` and `cloud.state` to `RpcNotifications`;
  - remove `secrets.setAgentCloudCredential` and `secrets.clearAgentCloudCredential`.
- **`Contracts/Protocol/Messages.cs`:** add `CloudSessionRequest` and `JobsAvailableRequest { Jobs: [{ OrderId, JobId }] }`. Remove `AgentCloudCredentialRequest`.
- **`Core/Handlers/Handlers.cs`:** add the three handlers. **Each only hands the message to the synchronizer and returns at once.** The pipe session handles frames one after another, so a slow handler would block every other call.
- **`Core/AgentRuntime.cs` and `Host/Program.cs`:**
  - build the synchronizer before the dispatcher, and pass it into the handlers;
  - stop wiring the job-event callback to `ReportAsync` directly; it enqueues into the report outbox (10.3).
- **Remove:** the `agentCloud` credential from `WindowsCredentialStore`, `ISecretStore`, `MemorySecretStore`, and the `AgentCloudCredential` record.

### 10.2 Synchronizer (`Core/Cloud/AgentCloudSynchronizer.cs`), rewritten

**State:**

- current `CloudSession` (memory only);
- a wake channel (`Channel<WakeSignal>`, bounded and coalescing: many wakes collapse into one);
- the set of job IDs being claimed or staged.

**Loop** (one background task; idle when there's nothing to do):

1. Wait for a wake signal. Sources:
   - `jobs.available`;
   - a new `cloud.session` (which also flushes the report outbox);
   - completion of the previous batch, if the last wake had more than 10 jobs.
2. With no session, do nothing; wake again when a session arrives.
3. From the latest `jobs.available` list, drop jobs that are in flight or already in SQLite with this `cloud_job_id` and a non-terminal local state. Take up to 10.
4. `POST jobs/claim` with those jobs.
5. For each claimed job:
   - download with the **download client** (a separate `HttpClient` with a 5 min timeout; today one client with a 20 s timeout serves both);
   - verify SHA-256;
   - `Enqueue` into the local queue as today, with `CloudOrderId`, `CloudDocumentId`, `LeaseId` and the new `CloudShopId` and `CloudAgentId`.
6. On a staging failure, enqueue a FAILED report with `AGENT_STAGING_FAILED` (10.3).
7. Publish `cloud.state`.

**API calls:**

- API client: `HttpClient` with a 20 s timeout, `Authorization: Bearer <idToken>`, and base URL `CloudSession.ServerBaseUrl`.
- On a 401: emit `cloud.tokenRequired`, wait up to 30 s for a new session, retry once, then give up until the next session.

### 10.3 Report outbox

**SQLite** (`Core/Jobs/SqliteJobStore.cs`), new columns on `jobs`:

| Column | Purpose |
| --- | --- |
| `cloud_shop_id`, `cloud_agent_id` | Which shop and agent the job belongs to. Reports go out only while a session for the same shop is active (a PC switching shops doesn't send reports with the wrong token). |
| `report_state` | `none` \| `pending` \| `sent` \| `acked` \| `rejected`. Replaces `cloud_acked`; migrate `cloud_acked = 1` to `acked`. |
| `report_attempts`, `report_next_at` | Backoff |
| `report_last_error` | Diagnostics |

**Flow:**

- When a local job reaches COMPLETED, FAILED or CANCELLED, the worker callback sets `report_state = pending`, then signals the reporter. No HTTP happens in the callback.
- The reporter batches pending reports for the active shop, up to 20, waiting 1 s to gather a batch, and calls `POST jobs/report`.
- For each result:
  - `ok` → `acked`;
  - `lease_mismatch`, `invalid_state` or `not_found` → `rejected` (logged, never re-sent);
  - `retry` → stays `pending` with backoff.
- A whole-request failure (network, 429, 5xx) means backoff for all of them: 1 s, doubling to 5 min, plus jitter, honouring `Retry-After`.
- **Timers exist only while there are pending reports.** With none, the reporter waits on its signal.
- **On start, and on each new session,** send every pending report for that shop once.
- **Local retry** (`Retry`, which resets the old `cloud_acked = 0`) sets `report_state = none` for the new attempt. A cloud retry produces a new lease through a new claim.

**Removed:**

- `RunAsync` polling;
- the `SynchronizeOnceAsync` sweep;
- the per-job claim, ticket, PATCH and shred calls;
- the PRINTING report on `job.started`.

### 10.4 Tests (`tests/Ctrlp.PrintAgent.Tests`, xUnit)

There are no synchronizer tests today. Add them with a fake `HttpMessageHandler`:

1. Claim on wake: skips in-flight and known jobs, takes at most 10, stages and enqueues.
2. Staging failure enqueues a FAILED report.
3. Results `ok`, `rejected` and `retry` move `report_state` correctly. A 5xx backs off; `Retry-After` is honoured.
4. A 401 emits `cloud.tokenRequired`, retries after a new session, and gives up without one.
5. Reports for another shop are held while a different shop's session is active.
6. Coalescing: 10 `jobs.available` notifications in 100 ms produce one claim.
7. SQLite migration from `cloud_acked`.
8. Handlers return in under 10 ms, so a slow claim never blocks the pipe.

---

## 11. Customer web app (`apps/printUserWebapp`)

### 11.1 Tracking with a listener

**Where:**

- `src/hooks/use-order-tracking.ts`
- `src/data/tracking-repository.ts`
- `src/data/tracking-constants.ts`
- `src/app/s/[slug]/order-status/page.tsx`

**Tasks:**

- **New `src/lib/firebase-client.ts`,** imported with a dynamic `import()` **on the tracking page only**, so other pages don't load the SDK.
  - It initialises auth with `browserSessionPersistence` and Firestore with the in-memory cache (one page, short-lived).
  - Env: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`. These are build-time values; on App Hosting they need BUILD and RUNTIME availability.
- **Session provider** (`shop-session-provider.tsx`): keep `firebaseToken` from the session response in memory (context), not in storage.
- **`use-order-tracking.ts`:**
  1. Sign in with `firebaseToken` if not signed in as that uid.
  2. `onSnapshot(doc(db, "orderTracking", orderId))`.
  3. Map with a new `mapTrackingDocToTracking`. It reuses `mapServerStatus`; the FAILED and PRINT_FAILED mappings can go, since the server never sets them.
  4. Detach on a terminal status or unmount.
- **Fallbacks:**
  - No `firebaseToken` (for example, a page opened in a new tab after the session expired), or the listener errors: one call to the existing `GET /public/session/orders/{orderId}`, plus a "Refresh" button. No polling.
- **"Shop hasn't confirmed your order yet":** shown when the status is `SUBMITTED` and `now - (times.paidAt ?? times.submittedAt) > 10 min`. The page's existing clock re-renders it; no network.
- **Remove:**
  - the `setInterval` poll (78–106) and `pollLatestOrderStatus`;
  - `POLLING_INTERVAL_MS`;
  - the dead code `createFromSubmittedOrder`, `createDemoOrder`, `getRealDocumentsFromSession`, `getCachedOrderTracking`, `saveCachedOrderTracking`;
  - the unused simulator bar and `transitionOrderStatus`.

### 11.2 Fewer guest API calls

- **Cart reuse:** keep the last `GuestSessionDto` in a module-level store, updated by every cart-changing response. The upload page restore (`s/[slug]/page.tsx` 106), the customize reconcile (`customize/page.tsx` 106) and `loadOrderDraft` (`order-repository.ts` 144) use it when present, and call `GET /public/session` only on a hard load.
- **One quote:**
  - Remove the quote in `initiateOnlinePaymentTransaction` (`payment-repository.ts` 56). Submit already re-quotes and returns `priceChanged`.
  - Debounce the quote after review edits (`use-review-order.ts` 182) by 500 ms.
  - Delete the unused `refreshPriceAuthoritatively`.
- **Delete dead code:** `src/hooks/use-payment.ts` and the redirect-only payment page logic, unless they're planned.

### 11.3 The proxy stays

All API calls keep going through `/api/[...path]` (design doc 8.4). Revisit above about 2,000 orders a day.

---

## 12. Observability and cost checks

### 12.1 Per-request Firestore counters (server)

- **Enabled by** `FIRESTORE_OP_COUNTERS=1`. On in staging, optional in production.
- **Mechanism:** an `AsyncLocalStorage` request context created in a small wrapper used by every route's top-level runner (`runShopOrder`, `runPrintUser`, `withOwnShop` and the agent job routes).
  - Count by wrapping the Admin SDK prototypes once, at `getFirebaseFirestore()` initialisation: `DocumentReference.get/set/update/delete/create`, `Query.get`, `Transaction.get/set/update/delete/create`, `WriteBatch.commit` (counting operations).
  - The Admin SDK has no hook, which is why it's wrapped.
- **Log:** one JSON line per request: `{ route, method, status, ms, reads, writes, deletes, coldStart }`.
- **Not counted here:** client listener reads, which never pass through the server. Use Cloud Monitoring (12.3) for totals.

### 12.2 Cost checks in CI and staging

- **A staging script places N orders** through the API (customer flow, desktop accept, agent claim and report via a test harness). It asserts reads, writes and requests per order within ±20% of design doc section 10.1.
- **Idle check:** run a desktop for 1 hour with no orders. Expect 0 API requests (from the logs) and fewer than 10 Firestore reads (from Monitoring).

### 12.3 Budget and usage alerts

- **Cloud Billing budget:** for example $5/month, alerting at 50%, 90% and 100%.
- **Cloud Monitoring alerts:**
  - `firestore.googleapis.com/document/read_count` above 40,000 a day;
  - `write_count` above 16,000 a day;
  - Cloud Run request count above 50,000 a day.

---

## 13. Work breakdown

Estimates are for one engineer who knows the code. Dependencies are by task ID.

### Phase 0: gate

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P0-01 | Firebase project setup: `firebase.json`, `.firebaserc`, web apps, env values (7.1, 7.5 steps 1–2) | — | 0.5 d | Emulator starts; desktop and web can load config |
| P0-02 | Minimized-window spike (section 3) | P0-01 | 1 d | Results table filled in; pass or F2 decided and written into this doc |

### Phase 1: foundation (server, rules, model)

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P1-01 | Rules and rules tests (7.2, 7.3) | P0-01 | 1 d | All tests in 7.3 pass in CI |
| P1-02 | Indexes file and deploy (7.4) | P0-01 | 0.25 d | Indexes built in staging |
| P1-03 | `ShopPrincipal` auth, claims required, route audit (5.1, 6.1) | — | 1 d | No `lookupIdToken` on request paths; audit table in the PR; all 36 routes pass smoke tests |
| P1-04 | Custom tokens on login/refresh and session start (5.2, 5.4) | P1-03 | 0.5 d | Responses include the tokens; the emulator can sign in with them |
| P1-05 | `applyOrderChange`, lifecycle times, drop `statusHistory`, transition idempotency by status, `searchKeys`, `completedDocumentIds`, tracking projection (4.1, 4.2, 6.2) | — | 2 d | Every writer uses the helper; unit tests for the transition table and projection; no `statusHistory` references |
| P1-06 | Op counters and budget alerts (12.1, 12.3) | — | 0.5 d | Log lines in staging; alerts configured |
| **Phase 1** | | | **5.25 d** | |

### Phase 2: push through Firestore

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P2-01 | Claim and report endpoints, retry lease fix, routing preference, accept `agentId`, remove server auto-accept, `devices/offline` printers, `lastActiveAt`, maintenance job (6.3, 6.5–6.7, 6.9) | P1-03, P1-05 | 2.5 d | Unit tests for claim/report (leases, replays, READY, shred retry); old agent routes deleted |
| P2-02 | Desktop Firebase session: `firebase.ts`, login/boot/sign-out, API token from SDK (8.2, 8.3) | P1-04, P0-02 | 1 d | Sign in, restart and sign out work; the cache is cleared on sign-out |
| P2-03 | Rust `notify`, `agent_notify`, `agent:ready`; C# protocol and handler stubs (9, 10.1) | — | 0.5 d | UI → agent notifications arrive; handler latency test passes |
| P2-04 | Live board and jobs listeners, adapters, connection badge, order details query (8.4) | P2-02, P1-01, P1-02 | 1.5 d | Orders screen works with no stream; adapter tests pass |
| P2-05 | Auto-accept, history and search queries (8.5, 8.6) | P2-04, P2-01 | 1 d | Paid orders accepted by the desktop; tabs, date and search work with paging |
| P2-06 | Agent synchronizer rewrite, report outbox, SQLite migration, download client, tests (10.2–10.4) | P2-01, P2-03 | 2.5 d | All tests in 10.4 pass; end-to-end print in staging |
| P2-07 | Remove the heartbeat, stream, poll loop and credential code (8.7, 6.6); update docs (section 17) | P2-04, P2-06 | 0.5 d | Grep finds none of the removed symbols; docs updated |
| **Phase 2** | | | **9.5 d** | |

### Phase 3: customer side and trims

| ID | Task | Depends on | Estimate | Done when |
| --- | --- | --- | --- | --- |
| P3-01 | Tracking listener, guest sign-in, fallback, "not confirmed" state, dead-code removal (11.1) | P1-01, P1-04, P1-05 | 1.5 d | Tracking updates live with 0 API requests after load |
| P3-02 | Signed cookie, read-once, shop config cache, cart reuse, one quote (6.8, 11.2) | — | 1.5 d | Per-order requests and reads within ±20% of the design model |
| P3-03 | `minInstances: 0`, `deployment.md` update, staging cost run (12.2) | P2-07 | 0.5 d | Cost check passes; idle check passes |
| **Phase 3** | | | **3.5 d** | |

**Total: about 19.75 days**, plus about 1.5 days for Phase 0.

**Critical path:** P0-01 → P0-02 → P2-02 → P2-04 → P2-05. In parallel: P1-03 → P1-04, and P1-05 → P2-01 → P2-06.

Two engineers could split the work into server and rules (P1-*, P2-01, P3-02) and desktop and agent (P2-02 to P2-07), finishing in about 2.5 weeks.

**Release order** (no existing users, so no compatibility layer): deploy indexes → deploy rules → server → desktop installer → web app. Phase 3 web changes can ship any time after P1-04 and P1-05 are deployed.

---

## 14. Test plan

### 14.1 Unit

| Area | Cases |
| --- | --- |
| Server: auth | Valid token with claims → principal; missing claims → 401; expired → 401; wrong shop → 403 |
| Server: orders | Transition table, including replay → no write and wrong state → 409; lifecycle time per status; projection written only for guest orders and only on visible changes; `searchKeys` contents |
| Server: jobs | Claim: only QUEUED for this agent, leases set, order → PRINTING once, `skipped` reasons. Report: replay `ok`, `lease_mismatch`, `invalid_state`, READY when the last document completes (also with duplicate jobs for one document), a failed delete returning `retry`. Retry clears the lease. Routing prefers the accepting PC. |
| Server: guest | Cookie sign and verify, expiry, IP mismatch, tampering; config cache TTL |
| Desktop (Vitest) | Snapshot → `OrderStore` events, including the cache-first snapshot (no notifications) and removals; `queuedForAgent`; `ordersToAutoAccept`; Asia/Kolkata day boundaries for history |
| Agent (xUnit) | Section 10.4 |
| Rules | Section 7.3 |

### 14.2 End to end (staging, real Windows PC)

| # | Scenario | Expected |
| --- | --- | --- |
| E1 | ONLINE order, 2 files, desktop focused | Accepted automatically; jobs claimed; printed; READY. Payment → claim p95 under 2 s (warm). |
| E2 | Same, desktop minimized for 1 hour first | Same timings |
| E3 | CASH order | Waits in New; the operator accepts; prints; READY; cash collected; COMPLETED |
| E4 | App closed when a paid order arrives | Order stays SUBMITTED; the customer sees "hasn't confirmed" after 10 minutes. App opened → auto-accepted → printed. |
| E5 | Job fails (printer offline) → operator retries | FAILED, then QUEUED with a new lease; the stale report is rejected; prints on retry |
| E6 | Network cut for 2 minutes during printing | Final report queued, then sent after reconnect; no duplicate prints |
| E7 | Network cut for 40 minutes | Listener re-reads its active set once (the reads are visible in Monitoring); no missed jobs |
| E8 | Agent killed mid-print | The app shows the agent failed (known limit); restart → SQLite marks the job failed → report sent |
| E9 | Two PCs, one paid order | One accept wins; jobs go to the accepting PC's printers |
| E10 | Sign out, then a different shop signs in on the same PC | No cached orders from the first shop; pending reports for the first shop are held, not sent |
| E11 | Token refresh during a long session (more than 2 hours) | No 401s in the logs; the agent gets new tokens |
| E12 | Customer tracking from payment to handover | Live updates; 0 API requests after load; the fallback works with Firebase blocked |
| E13 | Idle desktop for 1 hour | 0 API requests; fewer than 10 Firestore reads |

### 14.3 Cost acceptance

Run 12.2. Phase 3 is done when per-order requests, reads and writes are within ±20% of design doc section 10.1 and E13 passes.

---

## 15. Sequences

### 15.1 Desktop start (signed in before)

```text
UI                         API                        Firebase Auth / Firestore      Agent
 │ get stored refresh token (pipe) ───────────────────────────────────────────────▶│
 │◀────────────────────────────────────────────────────────────── refreshToken ─────│
 │ POST /api/auth/refresh ─▶│
 │◀─ tokens + firebaseCustomToken
 │ signInWithCustomToken ─────────────────────────────▶│
 │ POST /devices/register ─▶│ (lastActiveAt)
 │ notify cloud.session ──────────────────────────────────────────────────────────▶│
 │ attach listeners (live board, jobs) ───────────────▶│
 │◀───────────── first snapshots (from cache, then server)
 │ notify jobs.available (if any QUEUED for this agent) ──────────────────────────▶│
 │                                                                                  │ claim/report as needed
```

### 15.2 ONLINE order to print

```text
Customer      API                           Firestore              Desktop UI                Agent
 │ submit ───▶│ order SUBMITTED + tracking ─▶│
 │ pay ──────▶│ payment PAID (+ tracking) ──▶│── live board change ─▶│
 │            │                              │                       │ ordersToAutoAccept
 │            │◀──────────────── POST accept { agentId } ────────────│
 │            │ SHOP_ACCEPTED, jobs QUEUED ─▶│── jobs change ───────▶│
 │            │                              │                       │ jobs.available ─────────▶│
 │            │◀──────────────────────────────── POST jobs/claim ──────────────────────────────│
 │            │ DISPATCHING + leases, order PRINTING ─▶│                                        │
 │            │──────────────────────────────── claimed + download URLs ──────────────────────▶│
 │            │                                                                 download, print │
 │            │◀──────────────────────────────── POST jobs/report (COMPLETED) ─────────────────│
 │            │ job COMPLETED, completedDocumentIds, READY at the last one; delete storage object
 │◀── tracking listener: READY
```

### 15.3 Job failure and retry

```text
Agent: print fails → report FAILED (errorCode) → API: job FAILED → desktop shows the failure
Operator: Retry → API: FAILED → QUEUED, lease cleared → jobs listener → jobs.available → claim (new lease)
A late report carrying the old lease → result lease_mismatch → agent marks it rejected and stops
```

### 15.4 Token expiry during a call

```text
Agent: API call → 401 → notify cloud.tokenRequired → UI: getIdToken(true) → notify cloud.session
Agent: retry once with the new token → ok (or give up until the next session)
```

---

## 16. Found along the way

Fix these with the related task, or ticket them separately:

| Finding | Where | Handled by |
| --- | --- | --- |
| Shredding marks `shreddedAt` but never deletes the storage object | `confirmDocumentShredded`, `document.service.ts` | P2-01 (report deletes the object) |
| Files of rejected or cancelled orders are never deleted | — | P2-01 (maintenance job) |
| `retryPrintJob` keeps the old lease and timestamps | `print-job.service.ts` about 869 | P2-01 |
| A failure to set claims at registration is only logged | `auth.service.ts` 206–214 | P1-03 |
| The agent downloads files with a 20 s timeout shared with API calls | `AgentCloudSynchronizer.cs` | P2-06 |
| The desktop date filter compares UTC dates | `dashboard.ts` `filterOrders` | P2-05 |
| Rule drafts allow client writes (`orders create: if true`) and use `exists()`, which costs reads | `packages/firebase/docs/firestore.rules` and the MBP copy | P1-01 |
| Index drafts reference fields that are never written (`lifecycle.createdAt`, `priority`) | `packages/firebase/docs/firestore.indexes.json` | P1-02 |
| The guest order response returns the full `OrderDto`, including staff IDs and storage keys | `getGuestOrder` | P3-01 (trimmed) |
| The tracking UI maps FAILED and PRINT_FAILED, which the server never sets | `tracking-repository.ts` `mapServerStatus` | P3-01 |
| `packages/firebase/.env.example` contains a real-looking Web API key | `packages/firebase/.env.example` | Replace it with a placeholder and restrict the key (7.5). Separate ticket. |
| The bridge never reconnects after the agent process dies | `bridge.rs` | Out of scope (9.1) |
| No CI runs the server or web app checks | `.github/workflows` | Optional: add a workflow for server tests and rules tests in P1-01 |

---

## 17. Docs to update

Done in P2-07, except where noted.

| Doc | What changes |
| --- | --- |
| [`PRINT_SHOP_DESKTOP.md`](./PRINT_SHOP_DESKTOP.md) | Status line; §1 ("agent independently polls"); §2 rows on REST + SSE and "no Firebase SDK"; §4 methods and commands tables, plus the polling paragraph; §9 auth ("no Firebase SDK", "heartbeats every 30 seconds", env) |
| [`Order_to_Print_Execution_Runbook.md`](../developer-requirement/desktop-app/Order_to_Print_Execution_Runbook.md) | "Shipped flow" steps 5 and 7; credentials ("the agent never gets a Firebase token" → it gets the user's ID token in memory); "the synchronizer has no tests" |
| `apps/print-shop/AGENTS.md` | Lines 16 and 60: Firebase SDK allowed for auth and Firestore reads; no SSE |
| `apps/print-agent/AGENTS.md` | Line 79 (no Firebase SDK; still true unless F2); sync-loop rules at 87–92 (wake-driven claim, report outbox) |
| [`apps/server/docs/print-user.md`](../../apps/server/docs/print-user.md) | Signed cookie, `firebaseToken`, tracking projection (P3-02) |
| [`apps/server/docs/auth.md`](../../apps/server/docs/auth.md) | Claims-based principal, custom tokens (P1-03) |
| [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md) | Remove the SSE section; `minInstances: 0`; new secret `PRINT_USER_COOKIE_SECRET`; client Firebase env (P3-03) |
| [`packages/firebase/docs/`](../../packages/firebase/docs/) | Point to the real rules and indexes; document `createCustomToken` (P1-01) |
| [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](./DESKTOP_TRAFFIC_SCALING_PLAN.md) | Mark tasks done as phases land |

---

## 18. Out of scope

- A live "online now" indicator (design doc 9.1, Realtime Database).
- Running the agent as a Windows service (design doc 9.2).
- Moving print jobs to `shops/{shopId}/printJobs` (design doc 9.4).
- Removing the web app proxy (design doc 8.4).
- Staff-management routes. When built, they must follow 4.7.
- A real payment gateway; this plan only changes what happens after payment is confirmed.
- Reconnecting the Rust bridge after an agent crash.
