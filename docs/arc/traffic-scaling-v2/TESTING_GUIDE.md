# Traffic scaling v2: testing guide

Everything to test, how to test it, and what "pass" looks like. Each case has an ID; record results in the sheet in section 15. How the code works is in [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md).

**Covered:** all of Phases 1–3 on `fix/upload`: the server foundation (P1-00 to P1-07), agent-driven delivery (P2-01 to P2-07), and the customer side (P3-01 to P3-03). The end-to-end cases E1–E16 in the implementation plan map onto sections 9–12 here.

---

## 1. Before you start

### 1.1 Use a test project, not production

The env files in `apps/server` point at the real `meetctrlp` project. Server tests create shops, orders and Auth users, so point the server at a **staging Firebase project** or the **emulators** first. If you must use `meetctrlp`, use a throwaway shop and delete it afterwards.

### 1.2 Setup checklist

- [ ] `pnpm install` at the repo root.
- [ ] Server env (section 6.2 of the developer guide): `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_WEB_API_KEY`, `FIREBASE_DATABASE_URL`, `ALLOW_MOCK_PAYMENTS=1` in `apps/server/.env.development.local`, and optionally `FIRESTORE_OP_COUNTERS=1`, `PRINT_USER_COOKIE_SECRET` and `CTRLP_MAINTENANCE_SECRET`.
- [ ] Indexes and both rules files deployed to the test project (`firebase deploy --only firestore:indexes,firestore:rules,database`), and the indexes shown as built in the console. A board, history, search or sync call fails without its index.
- [ ] A doorbell visible in the console (Realtime Database → Data) after the first order.
- [ ] For the agent cases: `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_DATABASE_URL` in `apps/print-shop/.env`.
- [ ] For the web app's live tracking: the four `NEXT_PUBLIC_FIREBASE_*` values in `apps/printUserWebapp/.env.local`.
- [ ] Java 11+ for the rules tests (section 2.3).

### 1.3 Handy commands

Get a shop ID token (replace the identifier and password):

```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"owner@example.com","password":"secret123"}'
```

The response has `user.shopId` and `tokens.idToken`. Below, `$TOKEN` is the ID token, `$SHOP` is the shop ID, and `$AGENT` is the PC's agent ID (the `deviceId` from `POST /api/v1/devices/register`, or the agent document's ID in Firestore).

Decode a token's claims (no verification, just to look):

```bash
node -e "console.log(JSON.parse(Buffer.from(process.argv[1].split('.')[1],'base64url')))" "$TOKEN"
```

Fetch the board, as the desktop does:

```bash
curl -s "http://localhost:3000/api/v1/shops/$SHOP/board" -H "Authorization: Bearer $TOKEN"
```

Call `sync` as the agent does (only on a test shop: it claims jobs):

```bash
curl -s -X POST "http://localhost:3000/api/v1/shops/$SHOP/agents/$AGENT/sync" -H "Authorization: Bearer $TOKEN"
```

Watch the doorbell while you test: Firebase console → Realtime Database → Data → `doorbell/<shopId>`. The values flash when they change.

---

## 2. Automated tests

| ID | Command | Pass |
| --- | --- | --- |
| T1 | `pnpm --filter server test` | 52 tests, 0 failures. Covers principal claims, order rules, ring model, job rules (report decisions, retry and rescue), board rules (delta start, shop days), the guest cookie (sign, verify, tamper, IP, expiry, re-issue), mock-payment flag, guest helpers, PDF page count. |
| T2 | `pnpm --filter server typecheck` | No errors. If it fails inside `.next/types` or `.next/dev/types` with "Cannot find module" for a deleted route, those are stale generated files: delete the folder (or run the build) and rerun. |
| T3 | `pnpm --filter @ctrlp/firebase typecheck`, `pnpm --filter @ctrlp/types typecheck`, `pnpm --filter @ctrlp/schemas typecheck` | No errors |
| T4 | `pnpm --filter server build` and `pnpm --filter server lint` | Build succeeds; lint shows no errors |
| T5 | `pnpm shop:typecheck` and `pnpm --filter printUserWebapp typecheck` | No errors |
| T6 | `pnpm agent:test` | 76 tests pass. Covers SSE parser, token manager, doorbell client (watchdog at 65 s, polling after 3 broken, no polling after 40 s unreachable, back to streaming after 30 min), sync service (coalescing, de-duplication by job and lease, staging failure, retry backoff), report outbox (batches, per-job results, `Retry-After`), SQLite report columns, handlers. |
| T7 | `pnpm desktop:test` | Pass: the agent tests plus 38 desktop tests (board sync, stale-work nudge, board reducer, dashboard). |
| T8 | `cargo build` in `apps/print-shop/src-tauri` | Builds with no new warnings |
| T10 | `pnpm --filter printUserWebapp build` | Build succeeds. `pnpm --filter printUserWebapp lint` reports 17 findings, all older than this work; anything new is a failure. |

### 2.3 Rules tests (needs Java)

| ID | Command | Pass |
| --- | --- | --- |
| T9 | `pnpm firebase:rules:test` | All 11 tests pass: a guest reads only their own tracking document; listing is denied; shop orders and jobs are server-only; a shop A user reads `/doorbell/A` but not `/doorbell/B`; no client writes anywhere |

**These haven't been run yet.** Run them before deploying any rules.

---

## 3. Server: auth (P1-03)

| ID | Steps | Pass |
| --- | --- | --- |
| A1 | Register a new shop: `POST /api/auth/register`. Decode `tokens.idToken`. | The token has `shopId`, `shopUserId` and `role` claims. `GET /api/auth/me` with it returns 200. |
| A2 | Log in with an account created **before** this change (no claims). | Login returns 200, and its token now has the claims. Calls with the old token give `401 CLAIMS_MISSING`; calls with the new one work. |
| A3 | Call any shop route (for example `GET /api/v1/shops/$SHOP/pricing`) with a token that has no claims. | `401 {"error":"CLAIMS_MISSING"}` |
| A4 | Call `GET /api/v1/shops/<another shop id>/pricing` with your token. | `403` "shop does not match this account" |
| A5 | Call any shop route with an expired or garbage token. | `401 unauthorized` |
| A6 | Log in with the same account on PC A and PC B (or two curl sessions; keep both refresh tokens). `POST /api/auth/logout` on A with no body. Then refresh B's token: `POST /api/auth/refresh {"refreshToken":"<B's>"}`. | Logout returns 200. B's refresh **still works**. |
| A7 | `POST /api/auth/logout` with `{"allDevices":true}`, then refresh any of that user's refresh tokens. | The refresh fails (401). |
| A8 | Set the user's `status` to `INACTIVE` in Firestore, then `GET /api/auth/me`. | `403 account is not active`. (Other routes keep working until the token expires: accepted behaviour.) |
| A9 | With `FIRESTORE_OP_COUNTERS=1`, call `GET /api/v1/shops/$SHOP/pricing`. | The `request_ops` line shows only the reads for the pricing data itself; no auth lookups (previously 2 extra reads plus a call to Google). |

---

## 4. Server: payments and the mock gate (P1-00, P2-01)

| ID | Steps | Pass |
| --- | --- | --- |
| B1 | Without `ALLOW_MOCK_PAYMENTS`, restart the server and place an ONLINE order in the web app. | The payment step fails. The server answers `404` on `.../payments/mock-confirm`. The order stays SUBMITTED, payment PENDING. |
| B2 | With `ALLOW_MOCK_PAYMENTS=1`, repeat. | The payment succeeds and the order is PAID. |
| B3 | Call the payment webhook twice for the same order: `POST /api/v1/internal/payments/shops/$SHOP/orders/<id>/confirmed` with header `x-ctrlp-payment-secret` and body `{"paymentReference":"ref-1","idempotencyKey":"<new uuid each time>"}`. | Both return 200. The second makes **no** write: `payment.reference` and `payment.confirmedAt` don't change, and only one `order_paid` ring happens. |
| B4 | With the shop's `autoAcceptPaidOnline` on and the desktop **closed**, pay an ONLINE order. | The order stays SUBMITTED, PAID. The payment itself no longer accepts. |
| B5 | Now open the desktop (or, with it open, repeat B4). | Within a few seconds the agent's `sync` accepts it: SHOP_ACCEPTED with `lifecycle.paidAt` and `lifecycle.acceptedAt`. With auto-dispatch on, its jobs go to this PC's printers and print. |

---

## 5. Server: orders and jobs (P1-05)

Inspect documents in the Firestore console.

| ID | Steps | Pass |
| --- | --- | --- |
| C1 | Place a guest order in the web app. | `shops/{shop}/orders/{id}` has `channel: "PRINT_USER"`, `searchKeys`, `completedDocumentIds: []`, and `lifecycle` with all ten fields. **`orderTracking/{id}` exists.** |
| C2 | Open that `orderTracking` document. | It has status, payment method and status, total, items, times. It does **not** contain `storageKey`, `payment.reference`, user IDs or `customerPhone`. |
| C3 | Create a shop order on the desktop. | `channel: "SHOP"`, `searchKeys` filled; **no** `orderTracking` document. |
| C4 | Check any new order. | No `statusHistory` subcollection is created. |
| C5 | Accept the order from the desktop, then send the same accept again (same body). | Both 200. The order is accepted once. With auto-dispatch on, **only one set of print jobs** exists. |
| C6 | Accept an order that is already READY, or send `currentStatus` that doesn't match. | `409 ORDER_STATUS_CONFLICT`. On a CANCELLED order: `409 ORDER_ALREADY_CANCELLED`. |
| C7 | Walk a guest order through accept → printing → ready → complete. | Each step sets its `lifecycle.*At` time, and `orderTracking/{id}` follows each status within the same write. |
| C8 | Reject an order with a reason. | `status: REJECTED`, `lifecycle.rejectedAt`, `rejection.reason`; tracking copy shows `rejectionReason`. |
| C9 | Collect cash on a READY CASH order, then send the same request again. | Both 200. `payment.status: PAID` and `lifecycle.paidAt` set. The shop's `stats.cashInDrawerTodayPaise` rises **once**. |
| C10 | Complete the order twice. | Both 200; `stats.totalOrdersToday` rises **once**. |
| C11 | Dispatch a document that already has a QUEUED or DISPATCHING job: `POST /api/v1/shops/$SHOP/orders/<id>/jobs` with a new `idempotencyKey`. | `409 JOB_ACTIVE` |
| C12 | Dispatch a document whose `shreddedAt` is set. | `409 DOCUMENT_SHREDDED` |
| C13 | Print a 2-document order. | After the first job completes, `completedDocumentIds` has one ID. After the second: both, and the order becomes READY with `lifecycle.readyAt`. |
| C14 | Search keys: for an order `ORD-1042` with file `Resume_Final.pdf`, check `searchKeys`. | Contains `ord-1042`, `1042`, `resume`, `final`; not `pdf`. |

---

## 6. Server: doorbell rings and counters (P1-06, P1-07)

Keep the Realtime Database console open on `doorbell/<shopId>`.

| ID | Steps | Pass |
| --- | --- | --- |
| D1 | Place a guest order. | `boardAt` changes; `last` = `{ type: "order_submitted", orderId, orderNumber }`; `workAt` unchanged. |
| D2 | Pay an ONLINE order (mock or webhook). | `boardAt` and `workAt` both change; `last.type` = `order_paid`. |
| D3 | Accept a CASH order from the desktop with auto-dispatch on. | **One** write (watch for a single flash): `workAt` changes, and `last.type` is `jobs_queued`. The accept and the queued jobs were merged. |
| D4 | Mark ready, complete, reject, cancel, collect cash. | Each changes `boardAt` only, with `last.type` = `order_updated`. |
| D5 | Retry a FAILED job. | `workAt` changes; `last.type` = `jobs_queued`. |
| D6 | Repeat an action that's already done (C5, C9, B3). | **No** ring. |
| D7 | Unset `FIREBASE_DATABASE_URL`, restart, place an order. | The order succeeds. The log has one `ring_skipped` line (only once per server process). |
| D8 | Set `FIREBASE_DATABASE_URL` to a wrong host (for example `https://nope.invalid`), place an order. | The order succeeds after a short delay (2 attempts). The log has `{"message":"ring_failed", ...}`. |
| D9 | With the emulator: `FIREBASE_DATABASE_URL=http://127.0.0.1:9000?ns=<project>-default-rtdb`, run `pnpm firebase:emulators`, place an order. | The emulator's `doorbell/<shopId>` updates. |
| D10 | Let the agent claim a job (any print), then let it report. | Each step rings `boardAt` only (`order_updated`), never `workAt`: the agent doesn't wake itself. |
| E1 | With `FIRESTORE_OP_COUNTERS=1`, accept an order. | One JSON log line: `message: "request_ops"`, `route: "POST /api/v1/shops/.../accept"`, `status: 200`, `reads`, `writes`, `rings: 1`, `ringFailures: 0`, `coldStart`. |
| E2 | The first request after a server start. | `coldStart: true`; later requests `false`. |

---

## 7. Server: guest token and cookie (P1-04, P3-02)

| ID | Steps | Pass |
| --- | --- | --- |
| F1 | Start a guest session: open a shop page in the web app, or `POST /api/v1/public/shops/<slug>/session`. | The response has `firebaseToken` (a long JWT string). If signing failed, it's `null` and the server logs "Failed to sign a guest Firebase token". |
| F2 | Look at the `ctrlp_print_user` cookie in the browser's dev tools. | Six dot-separated parts starting with `v1.`, `HttpOnly`. The session response's documents have no `storageKey`. |
| F3 | Edit one character of the cookie's last part, then reload the review page (or `GET /api/v1/public/session`). | `401`. Opening the shop page again starts a new, empty cart. |
| F4 | Use the same cookie from another network (copy it to a phone on mobile data, or switch Wi-Fi to a hotspot). | Cart routes return `401`; the shop page starts a new cart. |
| F5 | With `FIRESTORE_OP_COUNTERS=1`, open the tracking page's fallback read (`GET /api/v1/public/session/orders/<id>`). | `reads: 1` (the order); no session read. |
| F6 | With counters on, make several cart calls within an hour of starting the session. | No session-expiry writes. After the cookie is over an hour old, the next request re-issues it (`Set-Cookie`) and writes `expiresAt` once. |
| F7 | Unset `PRINT_USER_COOKIE_SECRET` in a production build (`next build` then `next start`), then open a shop page. | Guest requests fail with `503 authentication is not configured`, and the log names `PRINT_USER_COOKIE_SECRET`. (Proves production can't run without it.) |

---

## 8. Agent and desktop connection (P2-03, P2-05)

Run on a real Windows PC, with the app built from `fix/upload`. Get the agent log from the app's log export (`host.exportLog`), or watch `cloud.state` in the UI's dev tools.

| ID | Steps | Pass |
| --- | --- | --- |
| H1 | Log in on the desktop. | The agent gets `cloud.configure` and `cloud.session`; `cloud.state` reaches `doorbell: connected`, `token: valid`. |
| H2 | With the app **minimized** for at least 10 minutes, place a guest order. | A Windows toast "New order ORD-…" appears within a few seconds, and the taskbar icon flashes. |
| H3 | Pay an ONLINE order while minimized. | Toast "Paid order ORD-…". |
| H4 | Restart the app when the last order is hours old. | **No** toast for the old order on start. |
| H5 | Leave the app running for 3 hours or more. | The stream reconnects at each hour (log: `auth_revoked` → reconnect within 5 s); no API 401s; memory steady. |
| H6 | Turn Wi-Fi off for 2 minutes, then on. | Reconnects within about 5 s of the network returning; `cloud.state.doorbell` never shows `polling`. |
| H7 | Sleep the PC for 5 minutes, then wake it. | Reconnects within 30 s of waking. |
| H8 | Close the app window. | The agent process (`ctrlp-print-agent.exe`) exits within a few seconds. In Firestore, the agent document and **its printers** become `OFFLINE`. |
| H9 | Close and reopen the app within 2 seconds. | The new app gets a working agent (the old one finishes, the new one starts within 10 s). |
| H10 | Sign out. | The agent closes the stream; `cloud.state` shows `token: none`. Another PC signed in to the same account stays signed in. |
| H11 | Revoke the user's refresh tokens (A7), then wait for the next refresh or restart the app. | `cloud.state.token` = `invalid` and the UI shows the login screen. |
| H12 | Block `*.firebasedatabase.app` streaming on a test network, or use a network known to buffer. | After about 4 minutes, `cloud.state.doorbell` = `polling`; rings still arrive within about 60 s. |

---

## 9. Agent sync and printing (P2-01, P2-04)

Use Microsoft Print to PDF for most cases, and one physical printer for S1 and S9.

| ID | Steps | Pass |
| --- | --- | --- |
| S1 | Accept a CASH order with auto-dispatch on. | Within a few seconds the job goes `QUEUED` → `DISPATCHING` (with `leaseId`, `claimedAt`) → printed → `COMPLETED`. The order reaches READY by itself. |
| S2 | A 5-document order, mixed PDF and images. | Every document prints once; `completedDocumentIds` ends with all 5; READY. |
| S3 | Check the stored files after S1. | Each printed document has `shreddedAt`, and its object is gone from storage. A document shared by two jobs is kept until the last one finishes. |
| S4 | Close the desktop, accept an order from another PC with no printers (or via the API), then open the desktop. | The first sync after start claims the job and prints it. |
| S5 | Print a long job, and close the app mid-print. Reopen it. | The interrupted job becomes an explicit `FAILED` for the operator to retry. **No** duplicate output. |
| S6 | Disconnect the network after a job prints but before its report is sent (pull the cable as the page comes out). Reconnect after a minute. | `cloud.state.pendingReports` shows 1, then 0 after reconnecting. The order reaches READY. The job printed once. |
| S7 | Corrupt or delete one document's stored object, then dispatch it. | That job becomes `FAILED` with `AGENT_STAGING_FAILED`; the order's other documents still print. Retry after fixing it prints it. |
| S8 | Make a job stick: queue a job, then claim it yourself with the sync `curl` (section 1.3) before the agent does, so the agent never stages it. | Before 15 minutes, `POST .../orders/<id>/jobs/<jobId>/retry` returns `409 PRINT_JOB_STILL_ACTIVE`. After 15 minutes, the desktop marks the job stuck and offers a rescue; confirming re-queues it (lease cleared) and the agent prints it once. (A sync after 15 minutes would also re-deliver it to the same agent.) |
| S9 | Retry a FAILED job on a different printer that belongs to another PC. | The job moves to that printer's agent, which prints it. A late report from the first PC gets `lease_mismatch` and changes nothing. |
| S10 | Retry a FAILED cloud job from the desktop's queue. | The retry goes to the cloud (the job goes back to `QUEUED`); the local copy is **not** re-printed. Exactly one new print. |
| S11 | Call `sync` with the `curl` twice in a row while nothing is queued. | Both return `{ accepted: [], claimed: [], more: false }`. With counters on, each is a handful of reads (a few empty queries), no writes. |
| S12 | Queue more jobs than one sync returns (for example 30 single-page documents). | The first sync returns `more: true`; the agent calls again at once until everything is claimed. All print. |

---

## 10. Desktop board, history and search (P2-02, P2-06)

| ID | Steps | Pass |
| --- | --- | --- |
| K1 | Open the desktop with a few active orders. | One `GET .../board` (no `since`) in the network log; the board shows every active order. |
| K2 | Place a guest order while the window is visible. | It appears within about a second. The network log shows `GET .../board?since=…`, returning `full: false` and only the changed order. |
| K3 | Place 3 orders within one second. | One or two board fetches, not three (300 ms debounce). |
| K4 | Minimize the window, place an order, wait, then restore. | No board fetch while minimized (the toast still shows). One fetch on restore. |
| K5 | Leave the window open and idle for 10 minutes, with the printers steady. | **No** API requests at all in the network log. (Printer telemetry is sent only when a printer's state changes, so switching a printer off shows one request; that's expected.) |
| K6 | Change an order on PC A; watch PC B. | PC B updates within about a second. |
| K7 | Open order history; filter by status and by a date. | Results come from `GET .../orders?status=…&from=…&to=…`, newest first, with "load more" working. A date means a shop-time day (midnight to midnight, India time). |
| K8 | Search for an order number's digits (for example `1042`) and for a file-name word. | Both find the order. A search under 3 characters isn't sent. |
| K9 | Settings → connection: check the state, then press **Sync now**. | Shows doorbell and token state and pending reports; **Sync now** triggers one `sync` call. |
| K10 | Stop the doorbell from reaching the PC (H12), then queue a job for it. | Within about a minute of the job being queued, the stale-work nudge sends one `sync.request`; the job prints. No more than one nudge a minute. |
| K11 | Sign out. | The board clears; no API requests follow. |

---

## 11. Customer web app (P3-01, P3-02)

Use the browser's network tab, filtered to `/api/`.

| ID | Steps | Pass |
| --- | --- | --- |
| W1 | Place an order and land on the tracking page. | The Firebase SDK loads **only** on this page (the upload and review pages' network logs have no `firebase` chunks). |
| W2 | Leave the tracking page open; accept, print, ready and complete the order from the desktop. | Each status appears within about a second, with **no** `/api/` requests after the page loaded. After COMPLETED the listener stops (no more Firestore traffic). |
| W3 | Reject an order while its tracking page is open. | The page shows "Order rejected" and the reason. |
| W4 | Build the web app without the `NEXT_PUBLIC_FIREBASE_*` values, then open the tracking page. | One `GET /api/v1/public/session/orders/<id>`; the status shows; **Refresh** reads it again. No polling. |
| W5 | Open another guest's order ID on your tracking page (copy the URL from another browser). | Nothing is shown (the listener is denied, and the fallback returns 403). |
| W6 | Leave a paid or cash order SUBMITTED for 10 minutes with the tracking page open. | "The shop hasn't confirmed your order yet" appears at 10 minutes, without any API request. It disappears when the shop accepts. |
| W7 | Upload two files, go to customize, back to upload, then to review. | `GET /api/v1/public/session` is **not** called on any of those page changes (the session start already gave the cart). |
| W8 | Hard-reload the review page. | One session start (`POST .../session`), one quote. Still no `GET /api/v1/public/session`. |
| W9 | On review, tap **+** five times quickly. | Five `PUT .../documents/<id>` in order, then **one** quote about half a second after the last tap. The total matches. |
| W10 | Tap **+** and press Pay immediately. | The pending write and a quote complete before `POST .../orders`; no "price changed" notice. |
| W11 | Pay online. | The request sequence has no quote between the review page and `POST .../orders` (the order carries `expectedTotalPaise`). |
| W12 | Change the shop's prices on the desktop while a customer is on review, then pay. | `POST .../orders` answers `priceChanged: true`; the page shows the new total and asks again. |
| W13 | After placing an order, start a new one from the tracking page. | The upload page starts empty (one `GET /api/v1/public/session` to read the emptied cart). |

---

## 12. Deployment, cost and clean-up (P3-03)

Needs a staging deployment (`apps/server/docs/deployment.md`).

| ID | Steps | Pass |
| --- | --- | --- |
| X1 | Check the API backend's run settings. | `minInstances: 0`; after 15 idle minutes, Cloud Run shows 0 instances. |
| X2 | **Idle check:** leave a shop PC open for 1 hour with no orders and its printers steady. | 0 API requests in the backend logs; 0 Firestore reads (Monitoring); doorbell download about 10 KB or less for the hour (Realtime Database → Usage). |
| X3 | **Order script / cost check:** place 20 orders end to end (customer flow, printed by the agent) with counters on. | Reads, writes and requests per order within ±20% of design doc section 10.1. Sum the `request_ops` lines per order. |
| X4 | `POST /api/v1/internal/maintenance/daily` without the header, then with a wrong one. | Both `401`. |
| X5 | Call it with the right header after making an expired guest session with an uploaded file, and an order rejected 2 days ago. | 200 with counts. The session, its cart file and its Auth user are gone; the rejected order's files are deleted. A second run removes nothing new. |
| X6 | Create the Cloud Scheduler job and run it once from the console. | Status "Success"; the log shows the clean-up counts. |
| X7 | First request after an idle hour: upload a file and open the desktop board. | Both succeed; note the cold-start time (log `coldStart: true`). |

---

## 13. Field checks on shop networks (P0-03)

Uses the spike kit in `spikes/doorbell/` (on the dev PC only; it's gitignored). Steps are in that folder's `README.md`, sections 4.3–4.5 and 5.

| ID | Check | Pass |
| --- | --- | --- |
| P1 | 2–3 real shop networks, including one PC with third-party antivirus HTTPS scanning, and a mobile hotspot | Events arrive unbuffered; p95 under 500 ms |
| P2 | 40-minute network cut, on a PC that isn't the ringer | Reconnect within 30 s of the network returning; the first value is the latest |
| P3 | Sleep and resume (5 and 40 minutes) | Reconnect within 30 s of waking |
| P4 | Firebase console → Realtime Database → Usage → Downloads, over a run with one known listener | 25 KB or less per connection-hour |

Already measured on the dev PC (two runs, 72 and 78 minutes): p95 77–98 ms, nothing lost that reached the database, token expiry at exactly 60 minutes with reconnects in 0.8–1.3 s, idle cost about 6.4 KB/h.

---

## 14. Regression: things that must still work

| ID | Check | Pass |
| --- | --- | --- |
| R1 | Full guest flow in the web app: open shop, upload, customize, review, pay or choose cash, see the order status page | Works; the status page follows the order live (W2) |
| R2 | Desktop order list, accept, reject, ready, complete, cash | Works; the board follows each change (K2) |
| R3 | Desktop printer list and settings | Works |
| R4 | Shop profile, staff list, pricing, hours | Work with the new token checks |
| R5 | Upload limits: 10 files per cart, a 50 MB file, an unreadable PDF | Same errors as before |

---

## 15. Results sheet

Copy this table into the PR or a test log, and fill in each row.

| ID | Tester | Date | Result (pass / fail / blocked) | Notes |
| --- | --- | --- | --- | --- |
| T1–T8, T10 | | | | |
| T9 | | | | |
| A1–A9 | | | | |
| B1–B5 | | | | |
| C1–C14 | | | | |
| D1–D10, E1–E2 | | | | |
| F1–F7 | | | | |
| H1–H12 | | | | |
| S1–S12 | | | | |
| K1–K11 | | | | |
| W1–W13 | | | | |
| X1–X7 | | | | |
| P1–P4 | | | | |
| R1–R5 | | | | |

**When a case fails,** note the order ID, the shop ID, the time, and the relevant log lines (`request_ops`, `ring_failed`, `ring_unknown`, the agent log). That's enough to find the request.
