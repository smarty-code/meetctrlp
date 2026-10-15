# Traffic scaling v2: developer guide

How the doorbell design works in code, where each piece lives, and how to run it locally. Why it's built this way is in [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](../DESKTOP_TRAFFIC_SCALING_PLAN.md). The task list and contracts are in [`TRAFFIC_SCALING_V2_IMPLEMENTATION.md`](../TRAFFIC_SCALING_V2_IMPLEMENTATION.md). To test it, use [`TESTING_GUIDE.md`](./TESTING_GUIDE.md).

> **State on 15 Oct 2026.** Phases 1, 2 and 3 are all written and committed on `fix/upload`. **Nothing is deployed**, and no part has run against a staging project yet. What's left is in section 8.

---

## 1. The idea in one picture

```text
Customer web app ─┐                                Firestore
Desktop UI ───────┼──▶ API (apps/server) ───────▶   ├─ shops/... (server-only)
Print agent ──────┘                                 └─ orderTracking/{orderId} (guest-readable copy)
                         │                                    ▲
                         │ after each committed change:       │ onSnapshot (tracking page only)
                         │ ringShop()                         │
                         ▼                              Customer web app
             Realtime Database  /doorbell/{shopId} = { boardAt, workAt, last }
                         │ HTTPS event stream (SSE), one per shop PC
                         ▼
             Print agent (C#, Windows process)
               ├─ workAt changed  ─▶ POST .../agents/{agentId}/sync ─▶ stage and print ─▶ report outbox
               ├─ boardAt changed ─▶ pipe "board.changed" ─▶ desktop UI fetches GET .../board?since=
               └─ new/paid order  ─▶ pipe "orders.attention" ─▶ Rust shows a Windows toast
```

Five rules hold everywhere:

1. **No timers through our server.** An idle shop makes no API requests and no Firestore reads.
2. **Only the agent does time-critical work.** A minimized WebView2 window can't be trusted to run anything.
3. **Only the server reads and writes shop data.** Clients read Firestore only for `orderTracking`.
4. **The doorbell carries timestamps, never order data.** Everything real comes from the API.
5. **The agent acts on state, not on events.** A missed or merged ring delays work but can't lose it.

---

## 2. Code map

### Server (`apps/server`)

| Area | File | What it does |
| --- | --- | --- |
| Request context | `src/lib/request-context.ts` | Per-request `AsyncLocalStorage`. Runs "finishers" (doorbell rings) before the response is sent, and logs `request_ops` counters. The route runners open it. |
| Shop auth | `src/modules/auth/auth.service.ts` | `requireShopPrincipal`: verifies the ID token **locally** and reads the claims `{ shopId, shopUserId, role }`, with no network call and no reads. Also registration (claims required), login (repairs claims), `getCurrentShopUser`, and logout (`allDevices`). |
| Claims helpers | `src/modules/auth/principal.ts` | Pure: `principalFromClaims`, `claimsFor`, `claimsMatch`, `decodeJwtPayload`, `systemPrincipal`. |
| Request guard | `src/modules/auth/require-request.ts` | `readShopPrincipal(request)`. |
| Route runners | `src/modules/orders/order-http.ts` (`runShopOrder`), `src/modules/shops/shop-route.ts` (`withOwnShop`, `parseQuery`), `src/modules/print-user/print-user-http.ts` (`runPrintUser`) | Auth plus the request context. |
| Order rules | `src/modules/orders/order-model.ts` | Pure: allowed transitions, `decideTransition` (replay versus conflict), lifecycle time fields, `buildSearchKeys`, `trackingCopy`, `applyDottedUpdate`. |
| Single order writer | `src/modules/orders/order.service.ts` → `applyOrderChange` | Every status or customer-visible change goes through it inside a transaction. It checks the transition, stamps `lifecycle.*At` and `updatedAt` with the server time, skips no-ops, and writes `orderTracking/{orderId}` for guest orders. |
| Doorbell | `src/modules/realtime/doorbell.ts`, `ring-model.ts` | `ringShop(shopId, ring)`: a PATCH to `/doorbell/{shopId}.json` with database timestamps. 2 s timeout, one retry, never throws. Timeout → `ring_unknown`; error → `ring_failed`. Rings in one request are merged. |
| Agent sync and report | `src/modules/printing/agent-sync.service.ts` | `syncAgent`: auto-accepts paid online orders (when `autoAcceptPaidOnline`), claims this agent's `QUEUED` jobs with a new lease, re-delivers jobs stuck in `DISPATCHING` for 15 minutes (same lease), and returns 60-minute download links. `reportAgentJobs`: final reports, at most 20, checked against the lease. |
| Job rules | `src/modules/printing/job-model.ts` | Pure: `decideReport`, `allDocumentsDone`, `decideRetry`, `STUCK_JOB_MS`. |
| Print jobs | `src/modules/printing/print-job.service.ts` | Dispatch guards (one active job per document, no shredded documents), deterministic queue key, routing (`preferAgentId`), `retryPrintJob` (retry, re-route, rescue), `queueIncomingOrder`, rings. |
| Documents | `src/modules/documents/document.service.ts` | `documentDownload` (60-minute links, refused once shredded), `shredOrderDocument` (delete the file, then set `shreddedAt`). |
| Devices | `src/modules/devices/device.service.ts` | `registerShopDevice`, `touchAgentActivity` (`lastActiveAt`, at most every 10 minutes), `markDeviceOffline` (the agent and its printers). No heartbeat. |
| Board, history, search | `src/modules/orders/board.service.ts`, `board-model.ts` | `getBoard(since)`: the full board, or changes since a cursor (5 s overlap, cap 200, cursors older than a day get the full board). `listOrderHistory` and `searchOrders`: paged, newest first, shop-time dates (Asia/Kolkata). |
| Shop config cache | `src/modules/shops/shop-config.service.ts` → `getShopConfigByShopId` | 60 s per-instance cache; `invalidateShopConfig` on settings writes. |
| Maintenance | `src/modules/maintenance/maintenance.service.ts`, `app/api/v1/internal/maintenance/daily/route.ts` | Daily clean-up from Cloud Scheduler (header `x-ctrlp-maintenance-secret`): old tracking copies, expired guest sessions (files and Auth users), files of rejected and cancelled orders. |
| Guest cookie | `src/modules/print-user/print-user-cookie.ts` | Pure: `signGuestCookie`, `verifyGuestCookie`, `ipTag`, `shouldReissueCookie`, `cookieSecret`. Format `v1.<printUserId>.<shopId>.<expSec>.<ipTag>.<hmac>`. |
| Guest requests | `src/modules/print-user/print-user-http.ts`, `print-user-session.service.ts`, `print-user.service.ts` | `requirePrintUserSession` reads the guest from the cookie with no Firestore read; `slideSession` re-issues it hourly; `loadGuestSession` reads the cart only where it's needed; `getGuestOrderTracking` returns the tracking copy. |
| Guest token | `app/api/v1/public/shops/[slug]/session/route.ts` | Returns `firebaseToken` (a custom token, uid = `printUserId`). |
| Mock payment gate | `src/modules/print-user/print-user.helpers.ts` → `mockPaymentsAllowed` | The mock-confirm route returns 404 unless `ALLOW_MOCK_PAYMENTS=1`. |

### Shared packages

| Package | File | What it does |
| --- | --- | --- |
| `@ctrlp/firebase` | `src/auth.ts` | `createCustomToken(uid)`. |
| | `src/service-token.ts` | `getServiceAccessToken()`: an OAuth token from the Admin credential, used for Realtime Database REST writes. Cached, single-flight. |
| | `src/op-counters.ts` | Wraps Admin SDK prototypes when `FIRESTORE_OP_COUNTERS=1`. It counts at `Firestore.getAll`, `Query.get`, `Transaction.get/getAll` and `WriteBatch` writes only, so nothing counts twice. |
| | `firestore.rules`, `database.rules.json`, `firestore.indexes.json`, `test/rules.test.ts` | Deployed rules and indexes, plus their tests. Wired up by the repo-root `firebase.json`. |
| `@ctrlp/types` | `src/auth.ts` | `ShopPrincipal { uid, shopId, shopUserId, role }`. |
| `@ctrlp/schemas` | `src/auth.ts` | `logoutRequestSchema { allDevices? }`. |
| | `src/agent-sync.ts` | `acceptOrderRequestSchema { agentId? }`, report request and results, `SyncAgentResponse`. |
| | `src/board.ts` | Board, history and search query schemas. |

### Print agent (`apps/print-agent`)

All under `src/Ctrlp.PrintAgent.Core/Cloud/` unless noted.

| File | What it does |
| --- | --- |
| `FirebaseTokenManager.cs` | Owns the PC's login. Turns the refresh token in Credential Manager (`Ctrlp.PrintShop/refreshToken`) into ID tokens with Google's Secure Token API. Single-flight. Refreshes at 55 of 60 minutes. An HTTP 400 from Google sets `token: invalid`; network errors back off from 1 s doubling to 60 s. A rotated refresh token is stored. |
| `DoorbellClient.cs` | The SSE stream. 65 s watchdog. Every attempt ends as **Healthy**, **Unreachable**, **Broken** or **Fatal** (see 4.2). 3 Broken in a row → 60 s polling for 30 minutes. Raises sync, `board.changed` and `orders.attention`. |
| `SseParser.cs` | `event:` / `data:` parsing, ported from the spike. |
| `ConnectivityMonitor.cs` | Network-change and resume detection. Calls `DoorbellClient.Wake`. |
| `CloudApiClient.cs` | API calls with a Bearer token; one forced refresh and retry on 401; `MarkDeviceOfflineAsync` with a 2 s budget for shutdown. |
| `AgentSyncService.cs` | Waits for a sync signal (doorbell `workAt`, `sync.request`, a new session, start-up). Signals coalesce: many rings during a sync cause one more sync. Calls `sync`, repeats while `more`, and stages each claimed job. A job already held (same job ID and lease) isn't staged twice. A staging failure is recorded as `FAILED` with `AGENT_STAGING_FAILED`. Only a failed sync is retried (2 s doubling to 60 s). |
| `ReportOutbox.cs` | Sends final reports from SQLite (`report_state = pending`) in batches of 20 to `jobs/report`. `ok` → `acked`; `lease_mismatch`, `invalid_state`, `not_found` → `rejected`; `retry` or a failed call → back off (1 s doubling to 5 min), honouring `Retry-After`. Signalled by `Complete`, `Fail` and `Cancel`. |
| `AgentCloudContext.cs`, `AgentCloud.cs` | Holds `cloud.configure` and `cloud.session`; `CloudStatus` publishes `cloud.state`. |
| `AgentNotifier.cs` | Ordered one-way notifications to the UI. |
| `Jobs/SqliteJobStore.cs` | The journal. Cloud columns `cloud_shop_id`, `cloud_agent_id`, `error_code`, and the outbox columns `report_state`, `report_attempts`, `report_next_at`, `report_last_error`. `Complete`, `Fail` and `Cancel` set `report_state = pending` in the same update. |
| `Handlers/Handlers.cs` | `cloud.configure`, `cloud.session`, `cloud.clear`, `sync.request` (notifications) and `cloud.getIdToken` (request). |
| `Host/Program.cs` | Wiring. Shutdown: stop loops → close the stream → `POST /devices/offline` (2 s). The single-instance lock waits up to 10 s, so a quick restart isn't left without an agent. |
| `tests/.../Cloud/*`, `tests/.../SqliteJobStoreTests.cs` | xUnit on a fake clock and a fake `HttpMessageHandler`. |

### Desktop (`apps/print-shop`)

| File | What it does |
| --- | --- |
| `src-tauri/src/agent/bridge.rs` | `notify()` (a frame with no `id`; takes the `inner` lock, not `call_lock`), `agent:ready`, and `orders.attention` → Windows toast plus taskbar flash. |
| `src-tauri/src/commands.rs` | `agent_notify` (allowlisted to `cloud.configure`, `cloud.session`, `cloud.clear` and `sync.request`) and `agent_get_id_token`. |
| `src-tauri/src/agent/boot.rs` | Passes `--parent-pid`, so the agent exits with the app. |
| `src/lib/agent.ts` | `agentNotify`, `getAgentIdToken`, `listenAgentReady`, `AgentCloudState`. |
| `src/lib/session.ts` | Where API calls get their token: the login's own token right after a login (`seedLoginToken`), then the agent's (`cloud.getIdToken`). `onSignedOut` fires on a 401 after a forced refresh. |
| `src/lib/cloud.ts` | REST client with no token parameters (`configureCloudAuth`, `CloudError`): `fetchBoard`, `fetchOrderHistory`, `searchShopOrders`, `transitionShopOrder(..., agentId)`, `logoutSession` (this PC only). |
| `src/lib/board.ts` | `BoardSync`: fetches the board on `board.changed`, debounced 300 ms, only while the window is visible. A ring while hidden marks it dirty; focus catches up if dirty or older than 60 s. `hasStaleWork` and `createNudger`: at most one `sync.request` a minute when the board shows work the agent should have taken (a queued job for this PC, or a paid order still waiting, for over a minute). |
| `src/lib/orders.ts` | Reducer: `BOARD_SNAPSHOT` replaces, `BOARD_DELTA` upserts by `(id, updatedAt)`. |
| `src/lib/dashboard.ts` | `shopDay`, `isStuckCloudJob` (15 minutes in `DISPATCHING`). |
| `src/App.tsx` | Boot (`configureAgent`, `agent:ready`), login and sign-out sequence, `cloud.state` badge, the rescue confirmation (`confirmRescue`). Cloud jobs are retried in the cloud only. |
| `src/screens/OrdersScreen.tsx`, `SettingsScreen.tsx` | Server history and search (`loadHistory`, `searchOrders`); the connection state and **Sync now**. |

### Customer web app (`apps/printUserWebapp`)

| File | What it does |
| --- | --- |
| `src/lib/firebase-client.ts` | Loaded with a dynamic `import()` from the tracking page only. `signInGuest(token)` (session persistence), `watchOrderTracking(orderId)` (in-memory cache), `trackingListenerAvailable()`. |
| `src/hooks/use-order-tracking.ts` | Listens to `orderTracking/{orderId}`; detaches on a final status. Without a token, Firebase config or a working listener, reads once (`fetchOrderTracking`) and offers Refresh. A local 30 s clock drives the "shop hasn't confirmed" notice. |
| `src/data/tracking-repository.ts` | `normalizeTrackingDocument` (Timestamps to ISO), `mapTrackingToOrder`, `isAwaitingShop` (`SUBMITTED` for 10 minutes since `paidAt ?? submittedAt`). |
| `src/lib/cloud.ts` | Guest API client, and the **cart store**: every cart-changing response updates the last `GuestSessionDto`; `loadGuestSession({ fresh? })` reuses it. |
| `src/hooks/use-review-order.ts` | Review edits are written in order, then quoted once they pause (500 ms). Submit waits for pending writes and flushes a pending quote. |
| `src/data/payment-repository.ts` | The online submit sends the price the customer saw; the server answers `priceChanged` if it differs. No separate quote. |

---

## 3. How a request flows

### 3.1 Shop API call

1. The route calls `runShopOrder` or `withOwnShop`, which opens a request context.
2. `readShopPrincipal` reads the bearer token, and `verifyIdToken` checks it locally. Missing claims → `401 CLAIMS_MISSING`.
3. The service runs a Firestore transaction and calls `applyOrderChange`.
4. After the commit, the service calls `ringShop`. Inside a context the ring is queued and merged per shop.
5. Before the response is sent, the context's finisher sends the rings. With counters on, it logs one `request_ops` line.

### 3.2 Order status change

`transitionOrder(user, orderId, input, requiredFrom, next, extra)`:

| Current status | Result |
| --- | --- |
| Equals `next` | **Replay**: 200, no write, no ring |
| Equals `requiredFrom`, and the client's `currentStatus` agrees | Apply: status, `lifecycle.<x>At`, `updatedAt`, tracking copy; ring `order_updated` |
| Anything else | 409 `ORDER_STATUS_CONFLICT` (or `ORDER_ALREADY_CANCELLED`) |

Allowed moves: SUBMITTED → SHOP_ACCEPTED / REJECTED / CANCELLED; SHOP_ACCEPTED → PRINTING; PRINTING → READY; READY → COMPLETED.

Accept takes an optional `agentId`: the PC that accepted. Its printers are preferred when the jobs are routed.

### 3.3 What rings, and when

| Change | `work` | `last.type` |
| --- | --- | --- |
| Order created (guest or shop) | no | `order_submitted` |
| Online payment confirmed (first time only) | yes | `order_paid` |
| A print job created (dispatch, accept with auto-dispatch, or `sync`'s auto-queue) | yes, except when the job's agent is the one syncing (it gets the job in that same response) | `jobs_queued` |
| A job retried, re-routed or rescued | yes, if the job has an agent | `jobs_queued` |
| Any applied status change, cash collected | no | `order_updated` |
| A `sync` that accepted an order or claimed a job; a report that changed an order | no | `order_updated` |

Merging: `work` = any; `last` = the most important event (paid > submitted > queued > updated).

### 3.4 Agent sync and report

1. The doorbell's `workAt` changes (or the agent starts, the network returns, or the UI sends `sync.request`).
2. `AgentSyncService` calls `POST /api/v1/shops/{shopId}/agents/{agentId}/sync`. In order, the server:
   1. accepts paid online orders when `autoAcceptPaidOnline` is on, routing their jobs to this agent first;
   2. claims this agent's `QUEUED` jobs: `DISPATCHING`, a new `leaseId`, `claimedAt`;
   3. re-delivers this agent's jobs stuck in `DISPATCHING` for 15 minutes, with the same lease (`redelivered: true`);
   4. returns `{ accepted, claimed, more }`, each claimed job with a 60-minute download link (or `null` once the file is gone).
3. The agent repeats while `more` is true, then stages each job: download, check SHA-256, insert into SQLite.
4. When a job finishes, `Complete`/`Fail`/`Cancel` mark it `report_state = pending`, and the outbox sends `POST .../jobs/report`.
5. For each report, the server checks the lease (`decideReport`). On `COMPLETED` it adds the document to the order's `completedDocumentIds`, moves the order to `READY` once all documents are done, and shreds the file unless another active job uses it. If the delete fails, the answer is `retry` and the agent sends the report again later.

**Rescue (operator):** `POST .../orders/{orderId}/jobs/{jobId}/retry` puts a `FAILED` job back in the queue, re-routes a `QUEUED` one to another printer (and its agent), or takes back a job stuck in `DISPATCHING` for 15 minutes. The lease is cleared, so a late report from the old PC gets `lease_mismatch`. The desktop never re-prints its own local copy of a cloud job; retries happen in the cloud only.

### 3.5 Desktop board

- **Start:** `GET /api/v1/shops/{shopId}/board` returns `{ full: true, orders, jobs, cursor }`: active orders and unfinished jobs.
- **On `board.changed`:** `GET .../board?since=<cursor>` returns what changed since the cursor minus 5 s: `{ full: false, ... }`. Over 200 changes, or a cursor older than a day, gets the full board instead.
- **Merging:** by `(id, updatedAt)`, so the overlap and duplicates are harmless.
- **Older orders** come from `GET .../orders` (history: status, shop-time dates, cursor) and `GET .../orders/search?q=` (exact terms of 3 characters or more, from `searchKeys`).

### 3.6 Guest requests

- **Who's calling:** the signed cookie names the guest, its shop and its expiry. Verifying it reads nothing. Cart routes then read `printUsers/{id}` once; tracking and mock-confirm read only the order.
- **Sliding expiry:** a cookie older than an hour is re-issued with a fresh 12 hours, and the session's `expiresAt` is written (one write an hour at most).
- **Cart reuse:** the session start returns the cart, and the web app keeps it in memory. Uploads, settings and deletes update that copy from their responses, so pages don't read the cart again. After an order is placed, the next order reads it once.
- **One quote:** the review page quotes after edits pause; the submit carries `expectedTotalPaise` and the server compares.
- **Tracking:** the session start returns `firebaseToken`. The tracking page signs in and listens to `orderTracking/{orderId}`. Firestore rules allow it only when `printUserId` matches the guest's uid.

---

## 4. The agent's doorbell, in detail

### 4.1 Token lifetime

- At 55 minutes, the agent refreshes the token. The open stream keeps its old token.
- At 60 minutes, the database sends `auth_revoked`. The agent reconnects with the cached fresh token (no second refresh). It refreshes first only if the token has less than 5 minutes left, or if the connection never received data.
- On a 401 from our API, one forced refresh, then a retry.

### 4.2 Connection outcomes

| Outcome | When | Next step |
| --- | --- | --- |
| Healthy | Got a `put` and stayed up 5 s or more, or ended with `auth_revoked`, or closed on resume | Reconnect at once; reset backoff and the broken count |
| Unreachable | DNS, connect or TLS failure; token refresh network error; **401 from the database** | Back off (1 s doubling to 60 s). Never counts toward polling. |
| Broken | Another HTTP error, no `put`, closed within 5 s, `cancel`, or the watchdog fired | Back off; broken count + 1 |
| Fatal | The token is invalid | Stop; `cloud.state.token = "invalid"` |

- 3 Broken in a row → poll `GET /doorbell/{shopId}.json` every 60 s for 30 minutes, then try the stream again.
- Network-change and resume events cut any wait short. Without them (a server outage while the PC's network is fine), the retry follows backoff, up to 60 s.

### 4.3 What the agent does with each value

| Change | Action |
| --- | --- |
| `workAt` newer than the last handled (starts at 0, so the first value after a start counts) | Signal sync |
| `boardAt` changed | `board.changed` to the UI |
| `last.type` is `order_submitted` or `order_paid`, not among the last 50 seen | `orders.attention` → Rust toast. The first value after a start toasts only if its `boardAt` is under 2 minutes old. |

### 4.4 `cloud.state`

`{ doorbell: connected | connecting | polling | offline, token: valid | refreshing | invalid | none, pendingReports, lastSyncAt?, lastError? }`. `none` means no session. The desktop shows it as a badge, and in Settings with **Sync now**.

---

## 5. Data model changes

| Where | Change |
| --- | --- |
| `shops/{shopId}/orders/{orderId}` | New: `channel` (`PRINT_USER` / `SHOP`), `searchKeys`, `completedDocumentIds`, `lifecycle.{paidAt, printingAt, rejectedAt, cancelledAt}`. Each document can carry `shreddedAt`. **Removed:** the `statusHistory` subcollection and transition idempotency documents. Orders created before this change have no `channel`, so they get no tracking copy. |
| `shops/{shopId}/orders/{orderId}/printJobs/{jobId}` | `leaseId` and `claimedAt` while `DISPATCHING`; `agentId` from routing; `retryCount`. |
| `shops/{shopId}/agents/{agentId}` | `lastActiveAt` (from sync and report). No heartbeat fields are written any more. |
| `orderTracking/{orderId}` | New customer-safe copy for guest orders: status, payment method and status, total, items, rejection reason, times. No staff IDs, payment references or storage keys. Removed 30 days after the order finishes. |
| `printUsers/{printUserId}` | `expiresAt` moves with the cookie (hourly) and with cart writes. |
| `shops/{shopId}/idempotencyKeys/queue:{orderId}:{documentId}` | Deterministic key for auto-queued jobs. |
| `/doorbell/{shopId}` (Realtime Database) | `{ boardAt, workAt, last: { type, orderId, orderNumber } }`, written only by the server. |
| Firebase Auth custom claims | `{ shopId, shopUserId, role }`, required. |
| Agent SQLite `queue.db` | Cloud and outbox columns (section 2). The old `cloud_acked` column is migrated into `report_state`. |
| Composite indexes | `orderTracking` (status, `updatedAt`); orders collection group (status, `lifecycle.rejectedAt`) and (status, `lifecycle.cancelledAt`); plus the Phase 1 indexes for jobs by agent, status and `claimedAt`, jobs by `updatedAt` (board deltas), and orders by `searchKeys`. |

---

## 6. Running it locally

### 6.1 Prerequisites

- Node 22, pnpm 11 (`pnpm install` at the repo root).
- .NET 8 SDK for the agent; Rust and the Tauri toolchain for the desktop (`pnpm desktop:setup`).
- **JDK 21+** only for the Firebase emulators (the rules tests and `pnpm --filter server test:emulator`). The repo's firebase-tools 15 refuses older Java.

### 6.2 Environment

Server, `apps/server`. Set real values outside git; see section 8.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_WEB_API_KEY` | Everything | As before |
| `FIREBASE_DATABASE_URL` | Doorbell rings | `https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app`, or `http://127.0.0.1:9000?ns=<project>-default-rtdb` for the emulator. Unset = rings skipped (`ring_skipped` logged once). |
| `PRINT_USER_COOKIE_SECRET` | Guest cookies | 32+ random characters. Optional locally: without it, `next dev` uses a per-process secret, so guests start over after a restart. **Required in production.** |
| `CTRLP_MAINTENANCE_SECRET` | The daily clean-up route | Optional locally. |
| `ALLOW_MOCK_PAYMENTS=1` | Online payment in the web app | Put it in `apps/server/.env.development.local` (read only by `next dev`). **Never in production.** |
| `FIRESTORE_OP_COUNTERS=1` | Cost logging | Optional; logs `request_ops` per request. |

Desktop, `apps/print-shop/.env`: `VITE_SERVER_BASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_DATABASE_URL`.

Web app, `apps/printUserWebapp/.env.local`: `NEXT_PUBLIC_API_BASE_URL`, and for live tracking `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`. Without the Firebase values the tracking page reads once and shows Refresh.

### 6.3 Start things

```bash
pnpm server:dev
```

```bash
pnpm webapp:dev
```

```bash
pnpm desktop:dev
```

Firebase emulators (Auth 9099, Firestore 8080, Database 9000):

```bash
pnpm firebase:emulators
```

Run the daily clean-up by hand (with `CTRLP_MAINTENANCE_SECRET` set in the server's env and in your shell):

```bash
curl -s -X POST http://localhost:3000/api/v1/internal/maintenance/daily -H "x-ctrlp-maintenance-secret: $CTRLP_MAINTENANCE_SECRET"
```

---

## 7. Adding to it: rules of thumb

- **Changing an order's status or anything the customer sees?** Do it inside a transaction through `applyOrderChange`, never with a direct `update`. Then call `ringShop` after the commit.
- **New work for the agent?** Make it state the agent finds on `sync` (a queued job, a paid order), then ring with `work: true`. Never send work in the ring.
- **Something the desktop must show?** Make sure the change sets `updatedAt`, so `board?since=` picks it up, and ring `order_updated`.
- **New route?** Use `runShopOrder`, `withOwnShop` or `runPrintUser`, so auth, ring merging and counters come for free. For a route that doesn't use them, wrap it in `runInRequestContext(requestRoute(request), ...)`.
- **Need the user's name or email?** Read the user document. The principal has only `uid`, `shopId`, `shopUserId` and `role`.
- **A server actor** (payment provider, maintenance): `systemPrincipal(shopId, actorId)`.
- **New Firestore query?** Add its composite index to `packages/firebase/firestore.indexes.json` and deploy the indexes before the code.
- **Pure logic goes in `*-model.ts` / `principal.ts` / `print-user-cookie.ts`** with a `*.test.ts` next to it, added to the `test` script in `apps/server/package.json`. Tests run with `node --test`, so test files must not import `@ctrlp/*` packages. Firestore transaction paths are tested in `apps/server/test/emulator/*.emulator.test.ts` instead: those import the real services and run against the emulators (testing guide 2.4).
- **The agent and desktop have no Firebase SDK.** The doorbell is plain HTTPS. Only the customer tracking page loads the Firebase JS SDK, and only with a dynamic `import()`.
- **Guest cart changes in the web app** go through `src/lib/cloud.ts`, so the cart store stays right. Don't call the API with `fetch` directly.

---

## 8. Known issues and open items

| Item | Status |
| --- | --- |
| **Secrets in git:** `apps/server/.env` and `.env.local` are tracked and hold the service-account private key and S3 secret key. Next.js loads both in production builds. | **Urgent.** Rotate both credentials, untrack the files, set the values as App Hosting secrets. |
| **Online payments in production** stop unless `ALLOW_MOCK_PAYMENTS=1` is set there, because there's no gateway yet | Product decision |
| The security rules are tested only against the emulators, not against a real project | `pnpm firebase:rules:test` (testing guide T9) passes, 11 of 11, as of 15 Oct 2026. Rerun it before deploying any rules change |
| Indexes and rules not deployed; no staging project; API keys not restricted; cost alerts not configured; Cloud Scheduler job not created | Ops tasks (implementation plan 7.5, 12.3; `apps/server/docs/deployment.md`) |
| The Firestore paths of `sync`, `report`, retry, board and maintenance are tested only against the emulators, not against a real project | `pnpm --filter server test:emulator` (testing guide T11) passes; the staging runs below still cover indexes, real storage and rings |
| Nothing has run end to end against staging: the 3-hour agent run, the staging print, the per-order cost check, the idle check | Implementation plan 12.2; testing guide sections 8 and 12 |
| P0-03 field checks on shop networks | Must pass before the agent reaches shops |
| Web app lint reports 17 findings (10 errors), all in files this work didn't change or older than it | Separate clean-up |
| The spike folder (`spikes/doorbell/`) is gitignored, so its README and shop kit exist only on the dev PC | Commit the source if the field checks will be run from another PC |
