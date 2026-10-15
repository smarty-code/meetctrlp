# Traffic scaling v2: developer guide

How the doorbell design works in code, where each piece lives, and how to run it locally. Why it's built this way is in [`DESKTOP_TRAFFIC_SCALING_PLAN.md`](../DESKTOP_TRAFFIC_SCALING_PLAN.md). The task list and contracts are in [`TRAFFIC_SCALING_V2_IMPLEMENTATION.md`](../TRAFFIC_SCALING_V2_IMPLEMENTATION.md). To test it, use [`TESTING_GUIDE.md`](./TESTING_GUIDE.md).

> **State on 15 Oct 2026.** Phase 1 (server), P2-03 and P2-05 (agent and Rust bridge) are all on `fix/upload` (`80ad1bf`), not deployed. P2-01, P2-02, P2-04, P2-06 and Phase 3 aren't built. Sections marked **(planned)** describe code that doesn't exist yet.

---

## 1. The idea in one picture

```text
Customer web app ─┐                                Firestore
Desktop UI ───────┼──▶ API (apps/server) ───────▶   ├─ shops/... (server-only)
Print agent ──────┘                                 └─ orderTracking/{orderId} (guest-readable copy)
                         │
                         │ after each committed change: ringShop()
                         ▼
             Realtime Database  /doorbell/{shopId} = { boardAt, workAt, last }
                         │ HTTPS event stream (SSE), one per shop PC
                         ▼
             Print agent (C#, Windows process)
               ├─ workAt changed  ─▶ sync with the API (planned: P2-01, P2-04)
               ├─ boardAt changed ─▶ pipe "board.changed" ─▶ desktop UI refetches (planned: P2-06)
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
| Route runners | `src/modules/orders/order-http.ts` (`runShopOrder`), `src/modules/shops/shop-route.ts` (`withOwnShop`), `src/modules/print-user/print-user-http.ts` (`runPrintUser`) | Auth plus the request context. |
| Order rules | `src/modules/orders/order-model.ts` | Pure: allowed transitions, `decideTransition` (replay versus conflict), lifecycle time fields, `buildSearchKeys`, `trackingCopy`, `applyDottedUpdate`. |
| Single order writer | `src/modules/orders/order.service.ts` → `applyOrderChange` | Every status or customer-visible change goes through it inside a transaction. It checks the transition, stamps `lifecycle.*At` and `updatedAt` with the server time, skips no-ops, and writes `orderTracking/{orderId}` for guest orders. |
| Doorbell | `src/modules/realtime/doorbell.ts`, `ring-model.ts` | `ringShop(shopId, ring)`: a PATCH to `/doorbell/{shopId}.json` with database timestamps. 2 s timeout, one retry, never throws. Timeout → `ring_unknown`; error → `ring_failed`. Rings in one request are merged. |
| Print jobs | `src/modules/printing/print-job.service.ts` | Dispatch guards (one active job per document, no shredded documents), deterministic queue key, rings. The old agent paths (`claimPrintJob`, `updatePrintJob`) remain until P2-01. |
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

### Print agent (`apps/print-agent`)

All under `src/Ctrlp.PrintAgent.Core/Cloud/` unless noted.

| File | What it does |
| --- | --- |
| `FirebaseTokenManager.cs` | Owns the PC's login. Turns the refresh token in Credential Manager (`Ctrlp.PrintShop/refreshToken`) into ID tokens with Google's Secure Token API. Single-flight. Refreshes at 55 of 60 minutes. An HTTP 400 from Google sets `token: invalid`; network errors back off from 1 s doubling to 60 s. A rotated refresh token is stored. |
| `DoorbellClient.cs` | The SSE stream. 65 s watchdog. Every attempt ends as **Healthy**, **Unreachable**, **Broken** or **Fatal** (see 4.2). 3 Broken in a row → 60 s polling for 30 minutes. Raises sync, `board.changed` and `orders.attention`. |
| `SseParser.cs` | `event:` / `data:` parsing, ported from the spike. |
| `ConnectivityMonitor.cs` | Network-change and resume detection. Calls `DoorbellClient.Wake`. |
| `CloudApiClient.cs` | API calls with a Bearer token; one forced refresh and retry on 401; `MarkDeviceOfflineAsync` with a 2 s budget for shutdown. |
| `AgentCloudContext.cs`, `AgentCloud.cs` | Holds `cloud.configure` and `cloud.session`; `CloudStatus` publishes `cloud.state`. |
| `AgentNotifier.cs` | Ordered one-way notifications to the UI. |
| `AgentCloudSynchronizer.cs` | **Interim.** The old poll loop, now using the ID token and woken by the doorbell. P2-04 replaces it with `AgentSyncService`. |
| `Handlers/Handlers.cs` | `cloud.configure`, `cloud.session`, `cloud.clear`, `sync.request` (notifications) and `cloud.getIdToken` (request). |
| `Host/Program.cs` | Shutdown: stop loops → close the stream → `POST /devices/offline` (2 s). The single-instance lock waits up to 10 s, so a quick restart isn't left without an agent. |
| `tests/.../Cloud/*` | xUnit on a fake clock and a fake `HttpMessageHandler`. |

### Desktop (`apps/print-shop`)

| File | What it does |
| --- | --- |
| `src-tauri/src/agent/bridge.rs` | `notify()` (a frame with no `id`; takes the `inner` lock, not `call_lock`), `agent:ready`, and `orders.attention` → Windows toast plus taskbar flash. |
| `src-tauri/src/commands.rs` | `agent_notify` (allowlisted to `cloud.configure`, `cloud.session`, `cloud.clear` and `sync.request`) and `agent_get_id_token`. |
| `src-tauri/src/agent/boot.rs` | Passes `--parent-pid`, so the agent exits with the app. |
| `src/lib/agent.ts` | `agentNotify`, `getAgentIdToken`, `listenAgentReady`, `AgentCloudState`. |
| `src/App.tsx` | `connectDevice` sends `cloud.configure` and `cloud.session`. The rest of the UI (board, history, token from the agent) is **planned** (P2-06). |

---

## 3. How a request flows today

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

### 3.3 What rings, and when

| Change | `work` | `last.type` |
| --- | --- | --- |
| Order created (guest or shop) | no | `order_submitted` |
| Online payment confirmed (first time only) | yes | `order_paid` |
| A print job created (dispatch or auto-queue), or a job retried | yes | `jobs_queued` |
| Any applied status change, cash collected, old-agent claim or job update | no | `order_updated` |

Merging: `work` = any; `last` = the most important event (paid > submitted > queued > updated).

### 3.4 Interim behaviour (until P2-01)

- **The server still auto-accepts paid online orders** when `autoAcceptPaidOnline` is on, and queues jobs when `autoDispatchAcceptedOrders` is on. P2-01 moves this into the agent's `sync`.
- The SSE order stream, the heartbeat route and the old agent routes still exist.
- Cloud jobs can be claimed but **not downloaded**: the server's job `document` route still requires the old agent key. This closes with P2-01 and P2-04.

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

`{ doorbell: connected | connecting | polling | offline, token: valid | refreshing | invalid | none, pendingReports, lastSyncAt?, lastError? }`. `none` means no session.

---

## 5. Data model changes (Phase 1)

| Where | Change |
| --- | --- |
| `shops/{shopId}/orders/{orderId}` | New: `channel` (`PRINT_USER` / `SHOP`), `searchKeys`, `completedDocumentIds`, `lifecycle.{paidAt, printingAt, rejectedAt, cancelledAt}`. **Removed:** the `statusHistory` subcollection and transition idempotency documents. Orders created before this change have no `channel`, so they get no tracking copy. |
| `orderTracking/{orderId}` | New customer-safe copy for guest orders: status, payment method and status, total, items, rejection reason, times. No staff IDs, payment references or storage keys. |
| `shops/{shopId}/idempotencyKeys/queue:{orderId}:{documentId}` | Deterministic key for auto-queued jobs. |
| `/doorbell/{shopId}` (Realtime Database) | `{ boardAt, workAt, last: { type, orderId, orderNumber } }`, written only by the server. |
| Firebase Auth custom claims | `{ shopId, shopUserId, role }`, required. |

---

## 6. Running it locally

### 6.1 Prerequisites

- Node 22, pnpm 11 (`pnpm install` at the repo root).
- .NET 8 SDK for the agent; Rust and the Tauri toolchain for the desktop (`pnpm desktop:setup`).
- **Java 11+** only for the Firebase emulators (the rules tests).

### 6.2 Environment

Server, `apps/server`. Set real values outside git; see section 8.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_WEB_API_KEY` | Everything | As before |
| `FIREBASE_DATABASE_URL` | Doorbell rings | `https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app`, or `http://127.0.0.1:9000?ns=<project>-default-rtdb` for the emulator. Unset = rings skipped (`ring_skipped` logged once). |
| `ALLOW_MOCK_PAYMENTS=1` | Online payment in the web app | Put it in `apps/server/.env.development.local` (read only by `next dev`). **Never in production.** |
| `FIRESTORE_OP_COUNTERS=1` | Cost logging | Optional; logs `request_ops` per request. |

Desktop, `apps/print-shop/.env`: `VITE_SERVER_BASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_DATABASE_URL`.

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

---

## 7. Adding to it: rules of thumb

- **Changing an order's status or anything the customer sees?** Do it inside a transaction through `applyOrderChange`, never with a direct `update`. Then call `ringShop` after the commit.
- **New route?** Use `runShopOrder`, `withOwnShop` or `runPrintUser`, so auth, ring merging and counters come for free. For a route that doesn't use them, wrap it in `runInRequestContext(requestRoute(request), ...)`.
- **Need the user's name or email?** Read the user document. The principal has only `uid`, `shopId`, `shopUserId` and `role`.
- **A server actor** (payment provider, agent key): `systemPrincipal(shopId, actorId)`.
- **New Firestore query?** Add its composite index to `packages/firebase/firestore.indexes.json` and deploy the indexes before the code.
- **Pure logic goes in `*-model.ts` / `principal.ts`** with a `*.test.ts` next to it, added to the `test` script in `apps/server/package.json`. Tests run with `node --test`, so test files must not import `@ctrlp/*` packages.
- **The agent and desktop have no Firebase SDK.** The doorbell is plain HTTPS.

---

## 8. Known issues and open items

| Item | Status |
| --- | --- |
| **Secrets in git:** `apps/server/.env` and `.env.local` are tracked and hold the service-account private key and S3 secret key. Next.js loads both in production builds. | **Urgent.** Rotate both credentials, untrack the files, set the values as App Hosting secrets. |
| **Online payments in production** stop unless `ALLOW_MOCK_PAYMENTS=1` is set there, because there's no gateway yet | Product decision |
| Rules tests not run (no Java on the dev PC) | Run them before deploying the rules |
| Indexes and rules not deployed; no staging project; API keys not restricted; cost alerts not configured | Ops tasks (implementation plan 7.5, 12.3) |
| Cloud jobs can't print (claimed but not downloaded) | Closes with P2-01 and P2-04 |
| Desktop UI still uses the SSE stream and the heartbeat | P2-06 |
| The spike folder (`spikes/doorbell/`) is gitignored, so its README and shop kit exist only on the dev PC | Commit the source if the field checks will be run from another PC |
