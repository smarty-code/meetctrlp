# Traffic scaling v2: testing guide

Everything to test for the work done so far, how to test it, and what "pass" looks like. Each case has an ID; record results in the sheet in section 9. How the code works is in [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md).

**Covered:** P1-00 to P1-07 (server), and P2-03 and P2-05 (agent and Rust bridge), all on `fix/upload`. **Not covered yet:** P2-01, P2-02, P2-04, P2-06 and Phase 3. They aren't built, and end-to-end cases E1–E16 in the implementation plan depend on them.

---

## 1. Before you start

### 1.1 Use a test project, not production

The env files in `apps/server` point at the real `meetctrlp` project. Server tests create shops, orders and Auth users, so point the server at a **staging Firebase project** or the **emulators** first. If you must use `meetctrlp`, use a throwaway shop and delete it afterwards.

### 1.2 Setup checklist

- [ ] `pnpm install` at the repo root.
- [ ] Server env (section 6.2 of the developer guide): `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_WEB_API_KEY`, `FIREBASE_DATABASE_URL`, `ALLOW_MOCK_PAYMENTS=1` in `apps/server/.env.development.local`, and optionally `FIRESTORE_OP_COUNTERS=1`.
- [ ] Realtime Database rules from `packages/firebase/database.rules.json` deployed to the test project, and a doorbell visible in the console (Realtime Database → Data).
- [ ] For the agent cases: set `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_DATABASE_URL` in `apps/print-shop/.env`.
- [ ] Java 11+ for the rules tests (section 2.3).

### 1.3 Handy commands

Get a shop ID token (replace the identifier and password):

```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"owner@example.com","password":"secret123"}'
```

The response has `user.shopId` and `tokens.idToken`. Below, `$TOKEN` is the ID token and `$SHOP` is the shop ID.

Decode a token's claims (no verification, just to look):

```bash
node -e "console.log(JSON.parse(Buffer.from(process.argv[1].split('.')[1],'base64url')))" "$TOKEN"
```

Watch the doorbell while you test: Firebase console → Realtime Database → Data → `doorbell/<shopId>`. The values flash when they change.

---

## 2. Automated tests

| ID | Command | Pass |
| --- | --- | --- |
| T1 | `pnpm --filter server test` | 35 tests, 0 failures. Covers principal claims, order rules, ring model, mock-payment flag, guest helpers. |
| T2 | `pnpm --filter server typecheck` | No errors. If it fails inside `.next/dev/types`, delete that folder (generated) and rerun. |
| T3 | `pnpm --filter @ctrlp/firebase typecheck`, `pnpm --filter @ctrlp/types typecheck`, `pnpm --filter @ctrlp/schemas typecheck` | No errors |
| T4 | `pnpm --filter server build` | Build succeeds |
| T5 | `pnpm shop:typecheck` and `pnpm --filter printUserWebapp typecheck` | No errors |
| T6 | `pnpm agent:test` | 61 tests pass. Covers SSE parser, token manager, doorbell client (watchdog at 65 s, polling after 3 broken, no polling after 40 s unreachable, back to streaming after 30 min), handlers. |
| T7 | `pnpm desktop:test` | Pass (24 desktop tests plus the agent tests) |
| T8 | `cargo build` in `apps/print-shop/src-tauri` | Builds with no new warnings |

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

## 4. Server: payments and the mock gate (P1-00)

| ID | Steps | Pass |
| --- | --- | --- |
| B1 | Without `ALLOW_MOCK_PAYMENTS`, restart the server and place an ONLINE order in the web app. | The payment step fails. The server answers `404` on `.../payments/mock-confirm`. The order stays SUBMITTED, payment PENDING. |
| B2 | With `ALLOW_MOCK_PAYMENTS=1`, repeat. | The payment succeeds and the order is PAID. |
| B3 | Call the payment webhook twice for the same order: `POST /api/v1/internal/payments/shops/$SHOP/orders/<id>/confirmed` with header `x-ctrlp-payment-secret` and body `{"paymentReference":"ref-1","idempotencyKey":"<new uuid each time>"}`. | Both return 200. The second makes **no** write: `payment.reference` and `payment.confirmedAt` don't change, and only one `order_paid` ring happens. |
| B4 | With the shop's `autoAcceptPaidOnline` on, pay an ONLINE order. | The order moves to SHOP_ACCEPTED with `lifecycle.paidAt` and `lifecycle.acceptedAt` set (interim behaviour until P2-01). |

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
| C13 | Print a 2-document order with the current agent. | After the first job completes, `completedDocumentIds` has one ID. After the second: both, and the order becomes READY with `lifecycle.readyAt`. |
| C14 | Search keys: for an order `ORD-1042` with file `Resume_Final.pdf`, check `searchKeys`. | Contains `ord-1042`, `1042`, `resume`, `final`; not `pdf`. |

---

## 6. Server: doorbell rings and counters (P1-06, P1-07)

Keep the Realtime Database console open on `doorbell/<shopId>`.

| ID | Steps | Pass |
| --- | --- | --- |
| D1 | Place a guest order. | `boardAt` changes; `last` = `{ type: "order_submitted", orderId, orderNumber }`; `workAt` unchanged. |
| D2 | Pay an ONLINE order (mock or webhook). | `boardAt` and `workAt` both change; `last.type` = `order_paid`. |
| D3 | Accept a CASH order with auto-dispatch on. | **One** write (watch for a single flash): `workAt` changes, and `last.type` is `jobs_queued`. The accept and the queued jobs were merged. |
| D4 | Mark ready, complete, reject, cancel, collect cash. | Each changes `boardAt` only, with `last.type` = `order_updated`. |
| D5 | Retry a FAILED job. | `workAt` changes; `last.type` = `jobs_queued`. |
| D6 | Repeat an action that's already done (C5, C9, B3). | **No** ring. |
| D7 | Unset `FIREBASE_DATABASE_URL`, restart, place an order. | The order succeeds. The log has one `ring_skipped` line (only once per server process). |
| D8 | Set `FIREBASE_DATABASE_URL` to a wrong host (for example `https://nope.invalid`), place an order. | The order succeeds after a short delay (2 attempts). The log has `{"message":"ring_failed", ...}`. |
| D9 | With the emulator: `FIREBASE_DATABASE_URL=http://127.0.0.1:9000?ns=<project>-default-rtdb`, run `pnpm firebase:emulators`, place an order. | The emulator's `doorbell/<shopId>` updates. |
| E1 | With `FIRESTORE_OP_COUNTERS=1`, accept an order. | One JSON log line: `message: "request_ops"`, `route: "POST /api/v1/shops/.../accept"`, `status: 200`, `reads`, `writes`, `rings: 1`, `ringFailures: 0`, `coldStart`. |
| E2 | The first request after a server start. | `coldStart: true`; later requests `false`. |

---

## 7. Server: guest token (P1-04)

| ID | Steps | Pass |
| --- | --- | --- |
| F1 | Start a guest session: open a shop page in the web app, or `POST /api/v1/public/shops/<slug>/session`. | The response has `firebaseToken` (a long JWT string). If signing failed, it's `null` and the server logs "Failed to sign a guest Firebase token". |
| F2 | Sign in with that token from a small script (Firebase JS SDK `signInWithCustomToken`) and read `orderTracking/<your order>`. | The read succeeds. Reading another guest's tracking document is denied. (The tracking page itself is P3-01.) |

---

## 8. Agent and desktop (P2-03, P2-05)

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
| H10 | Sign out. | The agent closes the stream; `cloud.state` shows `token: none`. |
| H11 | Revoke the user's refresh tokens (A7), then wait for the next refresh or restart the app. | `cloud.state.token` = `invalid` and the UI shows the login screen. |
| H12 | Block `*.firebasedatabase.app` streaming on a test network, or use a network known to buffer. | After about 4 minutes, `cloud.state.doorbell` = `polling`; rings still arrive within about 60 s. |

**Known limit:** cloud jobs don't print yet (the old download route needs the removed agent key). Don't log that as a failure; it closes with P2-01 and P2-04.

---

## 9. Field checks on shop networks (P0-03)

Uses the spike kit in `spikes/doorbell/` (on the dev PC only; it's gitignored). Steps are in that folder's `README.md`, sections 4.3–4.5 and 5.

| ID | Check | Pass |
| --- | --- | --- |
| P1 | 2–3 real shop networks, including one PC with third-party antivirus HTTPS scanning, and a mobile hotspot | Events arrive unbuffered; p95 under 500 ms |
| P2 | 40-minute network cut, on a PC that isn't the ringer | Reconnect within 30 s of the network returning; the first value is the latest |
| P3 | Sleep and resume (5 and 40 minutes) | Reconnect within 30 s of waking |
| P4 | Firebase console → Realtime Database → Usage → Downloads, over a run with one known listener | 25 KB or less per connection-hour |

Already measured on the dev PC (two runs, 72 and 78 minutes): p95 77–98 ms, nothing lost that reached the database, token expiry at exactly 60 minutes with reconnects in 0.8–1.3 s, idle cost about 6.4 KB/h.

---

## 10. Regression: things that must still work

| ID | Check | Pass |
| --- | --- | --- |
| R1 | Full guest flow in the web app: open shop, upload, customize, review, pay or choose cash, see the order status page | Works as before (the status page still polls until P3-01) |
| R2 | Desktop order list, accept, reject, ready, complete, cash | Works; the SSE stream still updates the list until P2-06 |
| R3 | Desktop printer list and settings | Works |
| R4 | Shop profile, staff list, pricing, hours | Work with the new token checks |

---

## 11. Results sheet

Copy this table into the PR or a test log, and fill in each row.

| ID | Tester | Date | Result (pass / fail / blocked) | Notes |
| --- | --- | --- | --- | --- |
| T1–T8 | | | | |
| T9 | | | | |
| A1–A9 | | | | |
| B1–B4 | | | | |
| C1–C14 | | | | |
| D1–D9, E1–E2 | | | | |
| F1–F2 | | | | |
| H1–H12 | | | | |
| P1–P4 | | | | |
| R1–R4 | | | | |

**When a case fails,** note the order ID, the shop ID, the time, and the relevant log lines (`request_ops`, `ring_failed`, `ring_unknown`, the agent log). That's enough to find the request.
