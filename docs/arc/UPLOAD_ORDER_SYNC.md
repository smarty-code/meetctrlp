# Upload, cart, order and print-job sync

This page describes how a customer's document travels from the web app to the shop's printer, and the rules that keep every copy of it in agreement: the browser, the server cart, the order, the print job, and the desktop agent's local queue.

It describes the system as built on `fix/upload` (October 2026). The diagnosis and the step-by-step plan that led here are in [`CtrlP_Print_User_Upload_Sync_Fix_Plan.md`](../developer-requirement/printUser-app/printUser-apps/CtrlP_Print_User_Upload_Sync_Fix_Plan.md).

## The rules

1. **The server cart is the truth for documents not yet ordered.** That cart is `printUsers/{printUserId}.documents`. The browser's copies are caches: React state, sessionStorage, IndexedDB and the `lastSession` module cache.
2. **A document is in exactly one place: the cart or one order.** Checkout moves documents from the cart into the order in a single Firestore transaction.
3. **A file is deleted only by whoever owns it.**
   - The cart deletes a file only after its transaction has removed the entry, so it never deletes a file an order needs.
   - An order's files are deleted after printing, when the order is cancelled, or by the daily clean-up.
4. **A guest is the browser holding the signed cookie.** IP plays no part in identity.
5. **What is billed is what prints.** One page-selection grammar serves the cart, the quote and the printer. The customer's orientation reaches the printer.
6. **A print job belongs to the PC holding its current lease.** When the shop cancels or rescues a job, the PC that held it is told to drop it.

## Lifecycle

```
Browser                         Server (Firestore + S3)                                 Shop PC
───────                         ───────────────────────                                 ───────
pick files ─► POST documents ──► cart entry UPLOADING  + presigned PUT URL
             PUT to S3 ────────► uploads/{shop}/{guest}/{doc}.ext
             POST …/complete ──► cart entry READY (pages counted, sha256)
             (Cancel: abort; the intent is deleted)
remove / Clear all ────────────► transaction removes entries, then files
submit ────────────────────────► ONE transaction: order SUBMITTED + cart emptied + activeOrderId
                                 CASH → shop board · ONLINE unpaid → hidden from board
pay (online) ──────────────────► payment PAID ─► agent sync auto-accepts (if configured)
cancel (unpaid, SUBMITTED) ────► CANCELLED, files deleted
                                 accept ─► queueIncomingOrder: one job per document
                                           (failures → order.queueErrors)
                                                                  sync {held} ◄────────── agent
                                 claim QUEUED → DISPATCHING + lease ──────────────────► stage per lease
                                 revoked leases (cancelled / rescued) ────────────────► drop, no report
                                                                  report ◄─────────────── print
                                 COMPLETED → order READY when all done; file shredded
```

## Customer web app (`apps/printUserWebapp`)

**Upload page** (`app/s/[slug]/page.tsx`, `components/documents-upload-card.tsx`, `components/upload-file-list.tsx`):

- **Restored cart.** The page lists the server cart's READY documents together with this visit's uploads, so a reload shows the cart again.
- **Each document.** Every row shows the document's state, with Remove (Cancel while it is uploading) and, on a failed upload, Retry.
- **Clear all.** It asks for confirmation, aborts every upload, empties the server cart, then clears local caches.
- **Continue.** It shows whenever at least one document is READY and nothing is uploading, clearing or being removed.
- **Auto-continue.** The page moves on by itself only after an upload batch that landed in full.
- **Picking.** Files can't be picked until the cart has loaded, so the 10-file cap counts what is already there.
- **Cancel Upload.** Every picked file gets an `AbortController` before it starts. `uploadGuestFile` (`lib/guest-upload.ts`) stops at any step with `UploadCancelledError`, aborts the PUT, and deletes the server intent, including one that arrives after the cancel.

**Deletes** (upload, customize, review):

- The UI removes the document at once, then waits for the server.
- If the delete fails, the document goes back in its place and a message is shown. Review instead reloads the order.
- `409 ALREADY_ORDERED` says the document is already in the order.

**Customize and review:**

- **Customize.** It paints from sessionStorage for speed, but keeps Continue disabled until the server cart has been read.
- **Review.** It is built only from the server cart (`loadOrderDraft`). When the cart can't be read, review shows its error and retry rather than stale copies.
- **Local estimate.** The price estimate shown before the server quote uses the shop's own rates.

**Browser storage:**

| Store | What | Cleared |
| --- | --- | --- |
| IndexedDB `ctrlp_files_store` | file bytes for previews, with `cachedAt` | per document on delete and Clear all; everything older than 12 h when the store first opens |
| sessionStorage `ctrlp-uploaded-files`, `ctrlp-configured-documents` | first-paint copies of the cart | Clear all, and an order placed (`clearStoredCart`) |
| sessionStorage `ctrlp-checkout-key` | idempotency key per cart document set + payment method | replaced when the documents or method change |
| sessionStorage `ctrlp-active-payment-transaction` | the online order awaiting payment | payment success, guest cancel |

**Session.** A 401 from any `/api/v1/public/session*` route makes `lib/cloud.ts` start the shop session again, once and shared by requests that fail together, and then retry the request. If the old session has ended, the retry lands in a new, empty cart.

**Payment and order page:**

- **Retry.** After a failed online payment, the review page keeps the placed order, and **Try Again** pays that same order. Cash is turned off for it.
- **Lost response.** After a submit that got no answer, the page re-reads the cart. An empty cart plus `activeOrderId` means the order was placed, so the page opens it.
- **After a reload.** With an unfinished online order, review redirects to that order's page.
- **Order page** (`components/tracking/order-pending-actions.tsx`):
  - **Pay now:** for an unpaid online order.
  - **Cancel order:** with confirmation, for any unpaid `SUBMITTED` order.

## Server (`apps/server`)

### Guest cart and checkout

The routes and their shapes are in [`apps/server/docs/print-user.md`](../../apps/server/docs/print-user.md). The behaviour:

- **Checkout** (`submitGuestOrder`) reads the idempotency key, the shop and the cart in one transaction, then:
  - It drops abandoned uploads.
  - It refuses with `409 DOCUMENTS_STILL_UPLOADING` while a live entry is still uploading.
  - It prices every document with the shared parser, and returns `priceChanged` when the total differs from `expectedTotalPaise`.
  - It writes the order and its tracking copy (`writePrintUserOrder`), empties the cart and sets `activeOrderId`.

  A retried key returns the original order. Only cash checkouts ring the shop.
- **Delete** (`deleteGuestDocument`) removes the entry in a transaction, then the file. It is idempotent (`removed: false`), and answers `409 ALREADY_ORDERED` for a document in the guest's latest order.
- **Clear all** (`clearGuestCart`) empties every entry in one transaction, then deletes the files.
- **Guest cancel** (`cancelGuestOrder` → `cancelUnpaidOrder`) works only while the order is `SUBMITTED` and unpaid. It records `cancellation.reason`, updates the tracking copy, and deletes the files (`shredAllOrderDocuments`). A payment confirmation for a cancelled order is refused with `409 ORDER_CANCELLED`.
- **Session start** resumes only the cookie's own session, from any network. Otherwise it creates a new one; `ipAddress` is kept for logging.

### Page selection and orientation

- **Page selection.** [`packages/schemas/src/page-selection.ts`](../../packages/schemas/src/page-selection.ts) (`@ctrlp/schemas/page-selection`) is the one grammar:
  - It accepts `all`/empty, or tokens such as `1,3,5-8`, with spaces around tokens allowed.
  - Any token out of range or malformed fails the whole selection.
  - The result is the page list and a canonical string.

  The cart stores the canonical form. Checkout re-reads every selection and bills `pages.length`. Dispatch parses the same way, so a selection the cart accepted always prints.
- **Orientation** goes from the cart's `config.orientation` to the order's `documents[].config.orientation`, then into the `queueIncomingOrder` overrides and the job's `resolvedSettings.orientation`, which the agent's executor applies. Orders from before this change keep the printer's preset.

### Jobs

- **Queueing.** `queueIncomingOrder` creates one job per document of an accepted order.
  - A document it can't queue is recorded in `order.queueErrors[{ documentId, code, message, at }]` and the shop is rung.
  - A later run that queues everything clears the list, and so does a successful manual dispatch of that document.
- **Retry** (`POST …/jobs/{jobId}/retry`) puts a FAILED job back in the queue, re-routes a QUEUED one, or rescues a DISPATCHING job that has been stuck for 15 minutes. It refuses:
  - `DOCUMENT_MISSING`: the file is gone from the bucket, checked with a HEAD request. If storage can't be reached, the retry goes ahead.
  - `DOCUMENT_SHREDDED`, `DOCUMENT_NOT_READY`, `DOCUMENT_NOT_FOUND`.
  - `ORDER_NOT_ACCEPTED`: the order no longer prints.
- **Cancel** (`POST …/jobs/{jobId}/cancel`, body `{ reason? }`) works on QUEUED and FAILED jobs, or on a claimed job whose PC has been quiet for 15 minutes (`decideCancel`).
  - A job a live PC holds gets `409 PRINT_JOB_STILL_ACTIVE`; a completed one gets `PRINT_JOB_STATUS_CONFLICT`.
  - Cancelling clears the lease and sets `errorCode: CANCELLED_BY_SHOP`. The document can be dispatched again.
- **Redelivery** of stuck jobs refreshes `claimedAt` and `updatedAt`, so board deltas see it.

### Agent sync and reports

- **`POST …/agents/{agentId}/sync`, body `{ held: [{ orderId, jobId, leaseId }] }`** (at most 100; `{}` is still valid). The server first answers `revoked: [{ orderId, jobId, leaseId, reason }]` (`revokedReason`):
  - `CANCELLED`: the shop cancelled the job.
  - `RESCUED`: the job was re-queued, or now has another lease or another PC.
  - `FINISHED`: the server already has the job's final result.
  - `NOT_FOUND`: the job is gone.

  It then auto-accepts paid orders, claims QUEUED jobs, and redelivers stuck ones. Because revocations are worked out before claiming, a job rescued onto the same PC is revoked under its old lease and claimed under a new one.
- **`POST …/agents/{agentId}/jobs/report`** parses each report on its own:
  - A report it can't read gets `invalid_state`, which the agent treats as final and does not retry.
  - `pagesPrinted` is clamped to the job's total.
  - Error texts are trimmed and cut to length.

### Board and daily clean-up

- **Board.** Online orders awaiting payment are left out of the full board and of deltas (`isAwaitingOnlinePayment`).
- **Daily clean-up** (`runDailyMaintenance`, Vercel Cron) runs these steps in order:
  1. Removes old tracking copies.
  2. Removes expired guest sessions and their cart files.
  3. Cancels online orders still unpaid 30 minutes after checkout (`PAYMENT_TIMEOUT`) and deletes their files. The summary reports this as `unpaidOrdersCancelled`.
  4. Removes the files of orders rejected or cancelled 1–8 days ago.

## Desktop agent and shop app (`apps/print-agent`, `apps/print-shop`)

- **Local queue.** It is scoped to the signed-in shop and agent. A sign-out or a shop switch never prints another shop's jobs.
- **Staging.** Files are staged per lease at `jobs/{cloudJobId}/{leaseId}/document.ext`. They are deleted on completion, or when a cloud job fails or is cancelled; leftovers are swept at start.
- **Sync.** Each sync sends `held`, and the agent applies `revoked` before `claimed`.
  - A queued row is cancelled with `LEASE_REVOKED` and its file deleted.
  - A row already at the spooler finishes.
  - In both cases its `report_state` is `revoked`, so nothing is reported under that lease.
- **Retry.** A cloud job is retried from the shop only, with a new lease; it is never re-printed locally.
- **Cancel.** The shop app cancels through the server. While a live PC holds the job, it falls back to a local cancel, which the agent reports under its own lease.
- **Reports.** `pagesPrinted` is clamped. A rejected batch is resent one report at a time. `PagesTotal` can be null.
- **Shop UI.**
  - It shows "Printing" for claimed cloud jobs, and never offers Cancel while a job is printing.
  - It shows `queueErrors` on the orders list and in order details.
  - Superseded local attempts appear as history.

Details: [`apps/print-agent/AGENTS.md`](../../apps/print-agent/AGENTS.md).

## Data model changes

| Where | Field | Notes |
| --- | --- | --- |
| guest cookie | `v2.<printUserId>.<shopId>.<expiresAtSeconds>.<hmac>` | v1 (with an IP tag) still verifies until it expires |
| `printUsers/{id}` | `documents[].config.pageSelection` | canonical (`all` or `1,3,5-8`) |
| `printUsers/{id}` | `ipAddress` | logging only; never used to find a session |
| `shops/{shop}/orders/{id}` | `documents[].config.orientation` | `PORTRAIT` / `LANDSCAPE` |
| `shops/{shop}/orders/{id}` | `queueErrors[]` | `{ documentId, code, message, at }` |
| `shops/{shop}/orders/{id}` | `cancellation.reason` | `GUEST_CANCELLED` / `PAYMENT_TIMEOUT` |
| `…/printJobs/{id}` | `status: CANCELLED`, `cancelledAt`, `cancelledByUserId` | from the job cancel route |
| `…/printJobs/{id}` | `resolvedSettings.orientation` | read by the agent's executor |
| `firestore.indexes.json` | `orders` collection group: `status`, `payment.method`, `payment.status`, `createdAt` | used by the unpaid-order clean-up |
| agent SQLite | `lease_id` in the staging path; `report_state = revoked` | see the agent's `AGENTS.md` |

## Error codes the clients act on

| Code | Status | Route | Meaning |
| --- | --- | --- | --- |
| `ALREADY_ORDERED` | 409 | `DELETE …/session/documents/{docId}` | the document is in the guest's order |
| `DOCUMENTS_STILL_UPLOADING` | 409 | `POST …/session/orders` | a cart file hasn't finished uploading |
| `ORDER_NOT_CANCELLABLE` | 409 | `POST …/session/orders/{id}/cancel` | the shop already has the order |
| `ORDER_ALREADY_PAID` | 409 | `POST …/session/orders/{id}/cancel` | paid orders are cancelled by the shop |
| `ORDER_CANCELLED` | 409 | payment confirmation | the order was cancelled first |
| `DOCUMENT_MISSING`, `DOCUMENT_SHREDDED`, `ORDER_NOT_ACCEPTED` | 409 | `POST …/jobs/{jobId}/retry` | nothing left to print |
| `PRINT_JOB_STILL_ACTIVE` | 409 | `…/jobs/{jobId}/retry`, `…/cancel` | a live PC holds the job |

## Operations

- **Deploy the index** before the clean-up needs it: `pnpm exec firebase deploy --only firestore:indexes --project meetctrlp`. Until then that step logs an error and skips; the other steps still run.
- **`PRINT_USER_COOKIE_SECRET`** must be set in production. Locally, without it, each dev-server restart gives every visitor a new empty cart, because cookies are no longer recovered by IP. Set one in `apps/server/.env.local` to keep carts across restarts.
- **`CTRLP_PROXY_SECRET`** now only affects which IP is recorded on a new session. It no longer decides whether a cart works.
- **Clean-up cadence.** It runs daily (Vercel Hobby cron), so an unpaid online order can wait up to a day before it is cancelled. It is hidden from the shop meanwhile.
- **Pay now and payment retry** use the mock payment confirmation, so they work only where `ALLOW_MOCK_PAYMENTS=1`, until a real gateway is wired in.

## Tests

| Command | Covers |
| --- | --- |
| `pnpm --filter server test:emulator` | Firestore emulator suites, including `guest-cart`, `guest-session`, `order-to-job`, `job-cancel`, `retry-print-job`, `agent-report`, `board`, `maintenance` |
| `node --experimental-strip-types --experimental-loader ./test/emulator/loader.mjs --test <unit files>` (from `apps/server`) | pure rules: cookie, helpers, job model, board model |
| `pnpm --filter @ctrlp/schemas test` | page-selection parser, business hours |
| `pnpm agent:test` / `pnpm shop:test` / `pnpm shop:typecheck` | agent queue, sync, outbox; shop UI logic |

`pnpm --filter server test` (plain Node, no loader) fails on `print-user.helpers.test.ts`. That failure predates this work: `print-user.helpers.ts` imports `./print-user-origin` without an extension.

## What was removed or replaced

| Removed | Replaced by |
| --- | --- |
| `createPrintUserOrder`, `checkoutPrintUserDocuments`, `findPrintUserOrderByIdempotencyKey` | one checkout transaction in `submitGuestOrder` with `pricePrintUserDocuments` / `writePrintUserOrder` |
| resume-by-IP (`findResumableSession`), the cookie's IP tag (`ipTag`) | cookie-only identity (`v2`) |
| file-first `removeGuestDocument`, 404 on a repeated delete | entry-first, idempotent delete; `ALREADY_ORDERED` |
| lenient cart page parser and the separate dispatch parser | `@ctrlp/schemas/page-selection` |
| `console.error` on a document that can't be queued | `order.queueErrors` |
| one bad report failing the whole report batch | per-report parsing |
| the web app's fire-and-forget deletes, and a Cancel Upload that did nothing | awaited deletes and abortable uploads |
| review falling back to sessionStorage documents | server cart only |
| the never-matching transaction restore on review | redirect to the unpaid order's page |
| unused code: `savePrintUserDocuments`, `getPublicShopById`, `requireActivePublicShop`, `firestoreNow`, `readPreset` (server). In the web app: `lib/page-selection.ts`, `PageSelectionControl`, `SwipeablePreviewContainer`, the old tracking cards (`OrderCompactSummary`, `OrderDocumentsPaymentCard`, `OrderEstimateCard`, `OrderStatusBanner`, `OrderTimeline`, `OrderTimelineItem`, `TrackingPaymentCard`, `TrackingShopCard`), `mapUploadedFilesToDocuments`, `mapFileListToDocuments`, `fetchPublicShop`, `formatCopies`, `formatPageCount`, the `*_ROUTES`/`PAYMENT_STATUS`/`PAYMENT_TIMINGS` constants, and the unread `ctrlp-order-draft` storage key | nothing (they had no callers) |

## Known gaps

- **Not tried in a browser:** the web app flows have not been exercised end to end, and no test runs the desktop agent against the server.
- **No switch to cash:** a placed online order can't be changed to cash.
- **No refunds:** a real gateway's late callback for a cancelled order is refused, and there is no refund flow.
- **Order cancel after acceptance:** the shop can't cancel an order once it is `SHOP_ACCEPTED` or `PRINTING`.
- **FAILED jobs of finished orders** still appear on the full board.
- **No page picker:** the customer can't choose pages in the web app yet. The parser is ready for it.
