# Upload ↔ Cart ↔ Order ↔ Print Job Sync: Diagnosis and Fix Plan

Branch: `fix/upload` · Drafted: 2026-10-16 · Status: decisions D-1–D-4 accepted as recommended. Phases 1–6 are done and merged on `fix/upload`, with automated tests passing. Phases 3–4 have not been tried in a browser, and there is no end-to-end run of the agent against the server. Phase 7's manual matrix is open. The built system is documented in [`docs/arc/UPLOAD_ORDER_SYNC.md`](../../../arc/UPLOAD_ORDER_SYNC.md). The older docs were updated to match, and dead code in these flows was removed (listed there).

## 1. Goal

What the customer sees in the web app, what the server holds, and what the shop desktop prints must always agree.

- **Upload.** An upload shows up in the cart once, and only once.
- **Delete.** Deleting a document removes it everywhere it can still be removed, or says clearly why it can't.
- **Reload.** A reload restores the same cart.
- **Clear all.** The customer can empty their cart in one action, on both the client and the server.
- **Desktop.** The desktop agent only ever receives jobs whose files exist, with the settings the customer chose.

## 2. How the pipeline works today

```
Browser                                  Server (Firestore + S3)                         Shop PC
───────                                  ───────────────────────                         ───────
React state  ─┐                          printUsers/{guestId}.documents[]   ← "cart"
sessionStorage├─ projection of ────────► (UPLOADING → READY | FAILED)
IndexedDB     │  the cart                  storage: uploads/{shop}/{guest}/{doc}.ext
lastSession  ─┘
                       submit ─────────► shops/{shop}/orders/{order}       (status SUBMITTED,
                                           documents[] copy the SAME storageKey   payment PENDING)
                                         then cart.documents -= ordered ids (separate transaction)
                                                 │ accept (manual, or agent sync for paid ONLINE)
                                                 ▼
                                         orders/{order}/printJobs/{job}     QUEUED
                                                 │ agent sync: claim + lease ──────────► SQLite jobs
                                                 │                                       download, print
                                                 ◄──────────── report COMPLETED/FAILED ──┘
                                         shred file on COMPLETED
```

> **No print job exists until an order is placed and accepted.** Before checkout, the customer's "job queue" is the server cart (`printUsers/{id}.documents`). After checkout it is the order, and its print jobs, on the shop board. Most of the mismatches below come from these two stages sharing one storage object, and from the client not treating the cart as its single source of truth.

## 3. Findings

Severity:

- **P0:** wrong print, lost or leaked data, or a user stuck in the flow.
- **P1:** the pipeline drifts out of sync.
- **P2:** hygiene problems that are still user-visible.

### 3.1 Web app: upload page

| # | Sev | Where | What happens |
|---|---|---|---|
| W1 | P0 | `apps/printUserWebapp/src/app/s/[slug]/page.tsx:223-231`, `components/documents-upload-card.tsx:80-87` | **"Cancel Upload" does nothing.** `handleCancelUpload` calls `onRemoveFile` only for files whose status is `uploading`, and `handleRemoveFile` returns early for exactly that status. Uploads keep going, the drawer stays open, and the page then auto-navigates to customize. There is also no way to abort the XHR (`lib/cloud.ts:374-400`), so a real cancel is not possible today. |
| W2 | P0 | `page.tsx:61-65`, `documents-upload-card.tsx:31-45, 146-153` | **The upload page has no file list, no Continue button, and no retry.** The progress drawer replaced the inline list. The `onRetryFile` prop is passed in but never read. Auto-continue needs every file to be `success`, so one failed file in a round blocks it permanently. The user sees "N documents added" with only "Upload More Documents" available, and is stuck. |
| W3 | P0 | `page.tsx:104-135` | **After a reload the user has no way forward.** The cart is restored with `uploadRound = 0`, so `isReadyToContinue` is never true. The documents are there, but the user can't continue, remove one, or clear them. This is the "stuck in the upload state" report. |
| W4 | P0 | nowhere | **No Clear All exists:** no UI, no client function, no server endpoint. |
| W5 | P0 | `page.tsx:229`, `customize/page.tsx:247-255`, `lib/guest-upload.ts:165` | **Deletes fail silently.** Every delete is fire-and-forget with `.catch(() => undefined)`. If the request fails (401, network, 5xx), the UI drops the file but the server keeps it. It comes back on reload, and **it is still ordered and billed**, because submit reads the server cart. |
| W6 | P1 | `page.tsx:184-185` | **The 10-file cap is checked before the restored cart has loaded.** Files picked in the first moments are counted against an empty list, so the server rejects the extras with a 400. Those error rows then block auto-continue (W2). |

### 3.2 Web app: state and storage hygiene

| # | Sev | Where | What happens |
|---|---|---|---|
| W7 | P1 | `lib/file-store.ts` (whole file) | **The IndexedDB file cache is never cleared.** Full file bytes stay in IndexedDB after delete, after the order is placed, and after the session expires. That is a privacy problem on shared phones and in-shop kiosks, and it uses up storage quota. `getDb()` also opens a new connection on every call and never closes it. |
| W8 | P1 | `customize/page.tsx:45-58`, `data/order-repository.ts:154-167` | **sessionStorage is never cleared after an order is placed.** `ctrlp-configured-documents` and `ctrlp-uploaded-files` keep the previous order's documents. The customize page paints them first, then replaces them with the server cart. If the cart read fails, review falls back to those stale documents and prices them locally with a hard-coded colour rate (`order-repository.ts:40-45`). |
| W9 | P2 | `lib/cloud.ts:222-245` | **The `lastSession` module cache only changes on successful writes.** A failed delete, or a change made in another tab, stays invisible until a hard reload. |
| W10 | P2 | `hooks/use-review-order.ts:70-71` | **The in-flight transaction is never restored.** Restore compares `existingTx.orderId` (the real order id) with `loaded.orderId`, which is always `draft-…`, so they never match. |

### 3.3 Server: cart, session and checkout

| # | Sev | Where | What happens |
|---|---|---|---|
| S1 | P0 | `apps/server/src/modules/print-user/print-user.service.ts:75-81, 221-224, 368-432`; `print-user-session.service.ts:251-276`; `orders/order.service.ts:516-589` | **A cart delete can destroy an ordered file.** The order copies the cart's `storageKey`. Order creation and cart checkout are two separate transactions. `removeGuestDocument` deletes the S3 object **before** it removes the cart entry, and it relies on a non-transactional read. So a delete or Clear All that lands between order creation and checkout leaves the order pointing at a deleted object. The same happens if checkout fails and the daily sweep later deletes the "cart" file (`maintenance/maintenance.service.ts:43-57`). Downstream, the agent download returns 404, the job goes `FAILED`, Retry loops forever, and the order never reaches READY. |
| S2 | P0 | `print-user-cookie.ts:57-72`, `print-user-session.service.ts:85-107, 156-159` | **Guest identity is tied to the IP address.** (a) The cookie only verifies from the IP it was issued to. When a phone switches between Wi-Fi and 4G, or the carrier NAT rotates, every request returns 401, and the client never re-establishes the session. (b) On reload, the session start falls back to "resume by shop + IP". With a new IP that creates an empty cart, so the documents seem to vanish. (c) With a shared IP (shop Wi-Fi, carrier CGNAT, or `127.0.0.1` in dev), a new visitor resumes **a stranger's cart**. They can see those documents, and their Clear All would delete them. |
| S3 | P0 | `print-user.service.ts:368-432`, `use-review-order.ts:309`, `data/payment-repository.ts` | **A failed or abandoned online payment leaves an orphaned order.** The order is created as `SUBMITTED / PENDING`, and the cart is emptied **before** payment. If payment fails, Retry sends a new idempotency key (`Date.now()`) against an empty cart and gets a 400. The unpaid order stays on the shop board indefinitely (`orders/board-model.ts:3`). Only the shop can cancel it, and maintenance never cleans up `SUBMITTED` orders. A lost submit response has the same effect: the order exists, but the client reports a failure. |
| S4 | P1 | `print-user.service.ts:382-383`, `print-user.helpers.ts:224-234` | **Documents still uploading are silently left out of the order.** `canSubmitGuestDocuments` receives the list already filtered to READY, so its "every document must finish uploading" check can never fail. Anything still uploading stays behind in the cart. |
| S5 | P1 | `print-user.service.ts:221-224` | **Delete is not idempotent and can't distinguish its failures.** A document that is already gone returns 404. That is indistinguishable from a document that was ordered, so the client can't tell the user "this is already in your order". |

### 3.4 Server: job pipeline

| # | Sev | Where | What happens |
|---|---|---|---|
| J1 | P0 | `print-user.helpers.ts:130-181` vs `printing/page-selection.ts`; `printing/print-job.service.ts:795-797` | **Two page-selection parsers disagree.** The cart validator quietly drops tokens that are out of range, so `"1,200"` on a 10-page PDF is accepted and billed as 1 page. The dispatcher's parser throws on the same input, and also on `"1 ,3"`. `queueIncomingOrder` catches the error and only calls `console.error`, so no job is created. The customer has paid, and the order sits in `SHOP_ACCEPTED`/`PRINTING` with a document that will never print. |
| J2 | P0 | `order.service.ts:441-497`, `print-job.service.ts:210-219, 788-793`; agent `WindowsDocumentPrintExecutor.cs:212` | **The customer's orientation never reaches the printer.** The cart stores `orientation`, but `PrintUserCheckoutDocument`, the order's `documents[].config`, the dispatch overrides, and `asSettings` all drop it. The executor does read `orientation`, but it never receives it, so a LANDSCAPE choice prints portrait. |
| J3 | P1 | `print-job.service.ts:667-751`, `order.service.ts:807-813`, `board-model.ts:5` | **The server has no way to cancel or dismiss a job.** Orders can only be cancelled from `SUBMITTED`. FAILED jobs stay on the board permanently. `retryPrintJob` never checks whether the file still exists or has been shredded, so Retry on a missing document re-fails endlessly. |
| J4 | P1 | `agent-sync.service.ts:97-172` | **Sync only adds work; nothing is ever revoked.** The agent is never told that a job or order was cancelled or rescued, and a lease is never revoked. A redelivery refreshes `claimedAt` without bumping `updatedAt` (`:167`), so board deltas miss it and the UI shows a stale "Rescue" button. |

### 3.5 Desktop agent (C#) and shop UI

These were found by the desktop audit. The `SqliteJobStore`, `ReportOutbox` and executor findings were re-checked in code.

| # | Sev | Where | What happens |
|---|---|---|---|
| D1 | P0 | `apps/print-agent/.../Jobs/SqliteJobStore.cs:279-307` | **`ClaimNext` prints any queued row, with no shop or agent filter.** After a sign-out or a shop switch, jobs from the previous shop still print, and their reports wait until that shop signs in again. |
| D2 | P0 | `SqliteJobStore.cs:315-316`, `PrintQueueWorker.cs:43-46` | **Local Retry reuses the old lease.** Its report is rejected (`lease_mismatch`/`invalid_state`), so the order never reaches READY and the file is never shredded. After an operator rescue this means a **duplicate print**. Files are staged per `jobId`, not per lease, so two rows can share one file, and the first to finish deletes it out from under the other. |
| D3 | P1 | `SqliteJobStore.cs:276-277` | **Local Cancel of a cloud job sends CANCELLED, but nothing re-dispatches the job or shreds the file.** The order stays in PRINTING forever. Cancelling a row that is already `failed` gets `invalid_state` back. |
| D4 | P1 | `Cloud/ReportOutbox.cs:261`, `packages/schemas/src/agent-sync.ts:19` | **One bad report poisons its whole batch.** `pagesPrinted = max(printed, pagesTotal)` can exceed the schema cap of 100,000. The server then rejects the entire report batch with a 400, the agent marks all 20 reports `rejected`, and those jobs stay `DISPATCHING` as zombies. |
| D5 | P2 | agent `SyncJob.PagesTotal` (non-nullable `int`) | **One bad value can break a whole sync.** The server sends `Number(job.pagesTotal ?? 1)`. If that is ever `NaN`, it serializes as `null`, and deserializing it throws for the entire sync. |
| D6 | P2 | print-shop `dashboard.ts:129,137`, `PrintQueueScreen.tsx:44,63` | **The shop UI shows the wrong status and a Cancel that does nothing.** A cloud job reads "dispatching" until its final report and never "printing", so Cancel is offered during printing even though it has no effect. |

## 4. Target behaviour (the contract)

1. **The server cart is the single source of truth.** Client state (React, sessionStorage, IndexedDB, `lastSession`) is a cache of it, and the client re-reads the cart after any failed write.
2. **A document is in exactly one place: the cart or one order.** Checkout moves the documents from the cart into the order in **one Firestore transaction**. Nothing that an order references can be deleted through the cart.
3. **Cart deletes are transactional and idempotent.** The entry is removed inside a transaction first, and the storage object is deleted only after that commits.
   - A document that is already gone returns `200 { removed: false }`.
   - A document that has already been ordered returns `409 ALREADY_ORDERED`.
4. **Clear All** = `DELETE /api/v1/public/session/documents`. It removes every cart entry (READY, UPLOADING and FAILED) in one transaction, then deletes their objects. On the client it also aborts in-flight uploads, purges IndexedDB and sessionStorage, and resets `lastSession`.
5. **A guest is identified by their signed cookie alone.** There is no IP-based resume, and IP is not part of cookie validity. On a 401 the client restarts the session once and retries.
6. **A placed but unpaid order belongs to the guest until the shop accepts it.**
   - The guest can retry payment on the *same* order, or cancel it.
   - Unpaid ONLINE orders older than a TTL are auto-cancelled.
   - The board shows them as "Awaiting payment", not as work to do.
7. **Every setting the customer can pick reaches the printer, or is rejected at cart time.** This covers orientation, a page selection parsed by one shared parser, copies, colour and paper.
8. **Job queueing failures are surfaced.** A document that can't be queued is recorded on the order, so the operator sees it. It is never just logged.

## 5. Decisions (accepted 2026-10-16, all as recommended)

| # | Decision | Recommendation |
|---|---|---|
| D-1 | Should Clear All also cancel a pending **unpaid** order (`activeOrderId`)? | **No.** Clear All empties the cart only. Unpaid orders get their own "Cancel order" action on the order-status page (Phase 4). Clear All then never silently touches anything the shop can already see. |
| D-2 | Guest identity: drop IP binding? | **Yes.** Remove the IP check from the cookie and remove resume-by-IP. Mobile IPs change all the time, and shared IPs leak carts. The cookie is already `httpOnly`, signed and short-lived. |
| D-3 | How should the cart and the order stop sharing a storage object? | **Atomic checkout plus delete-after-commit** (no object copy). The option is a server-side S3 `CopyObject` into `orders/{shop}/{order}/…` at checkout: the strongest isolation, but up to 10 copies per checkout. |
| D-4 | What happens to documents that are still uploading at submit? | **Reject** submit with `409 DOCUMENTS_STILL_UPLOADING`, so the order always contains what the customer saw. |

## 6. Fix plan

### Phase 1: Server cart and checkout correctness (S1, S4, S5, W4 server side) — DONE

- **Atomic checkout.** `submitGuestOrder` (`print-user.service.ts`) now runs a single transaction. `createPrintUserOrder`, `findPrintUserOrderByIdempotencyKey` and `checkoutPrintUserDocuments` were removed. In that transaction:
  1. Read the idempotency key, the shop and the cart. A replay returns the original order.
  2. Validate the cart's live entries, then price them with `pricePrintUserDocuments`. The quote is built from the same lines.
  3. Compare the price with `expectedTotalPaise`.
  4. Write the order, the tracking copy and the key with `writePrintUserOrder` (`order.service.ts`).
  5. Empty the cart and set `activeOrderId`.

  Abandoned uploads leave the cart with the order, and their files are deleted after commit.
- **Safe delete.** `removeGuestDocument` takes the entry out in a transaction first, and deletes the file only if that entry was still there. `DELETE …/documents/{docId}` returns `{ ok, removed }`. It is idempotent, so a document that is already gone returns `removed: false`. It returns `409 ALREADY_ORDERED` when the document is in the guest's `activeOrderId` order.
- **Clear All.** `DELETE /api/v1/public/session/documents` calls `clearGuestCart`. One transaction empties every entry, whether ready, uploading or failed, and then the files are deleted. It returns `{ ok, removed }`, and a placed order is not touched.
- **Submit validation.** Live entries that are still uploading now cause a `409 DOCUMENTS_STILL_UPLOADING`, instead of being silently left out.
- **No-op writes.** `mutatePrintUserDocuments` skips the write when the callback returns the same array.
- **Schemas.**
  - `@ctrlp/schemas` gained `PrintUserDeleteDocumentResponse`, `PrintUserClearCartResponse` and `PrintUserCartErrorCode`.
  - The web client (`lib/cloud.ts`) gained `clearGuestCart()` and `CART_ERROR`, and `deleteGuestDocument` now returns `removed`.
  - No UI uses these yet; that is Phase 3.
- **Tests.** `apps/server/test/emulator/guest-cart.emulator.test.ts` covers:
  - checkout and its replay
  - a key reused by another guest
  - submit while uploading
  - abandoned uploads at checkout
  - a price change and an empty cart
  - idempotent delete
  - deleting an ordered document
  - clear all
  - repeated delete-vs-checkout and clear-vs-checkout races, which check that no order ever loses its file
- **Known gap, for Phase 3.** If a storage PUT is still in flight when Clear All runs, it can re-create the object after Clear All has deleted it. That object is then an orphan, because its cart entry is already gone. The client-side abort in Phase 3 closes this.
- **Existing issue, not fixed.** `pnpm --filter server test` fails on `print-user.helpers.test.ts` on a clean tree too. `print-user.helpers.ts` imports `./print-user-origin` with no extension, which plain `node --experimental-strip-types` can't resolve. The test passes when run through the emulator suite's resolve hook (`test/emulator/loader.mjs`).

### Phase 2: Guest identity (S2) — DONE

- **Cookie.** The cookie is now `v2.<printUserId>.<shopId>.<expiresAtEpochSeconds>.<hmac>`, and `ipTag` is gone (`print-user-cookie.ts`).
  - A v1 cookie still verifies, with its IP tag ignored, until it expires; the hourly re-issue writes v2.
  - `readGuestPrincipal`, `writePrintUserCookie` and `requirePrintUserSession` no longer take the request.
- **Session start.** `findResumableSession` and the IP check on the cookie's session are removed (`print-user-session.service.ts`). No cookie, another shop's cookie, or an ended session now starts a new, empty cart. `ipAddress` is recorded on a new session for abuse logging only.
- **Per-document route.** `DELETE` and `PUT` on `…/documents/{docId}` now go through `runPrintUser`, so they also slide the session expiry.
- **Client.** In `lib/cloud.ts`, a `401` from any `/api/v1/public/session*` route starts the shop session again, at most once per request and shared by requests that fail together, then retries. When the old session has ended, the retry runs against the new, empty cart.
- **Tests.**
  - `print-user-cookie.test.ts` covers the v2 round-trip, that no IP is in the cookie, v1 compatibility from any IP, tampering, another key, mixed formats and expiry.
  - `test/emulator/guest-session.emulator.test.ts` covers resuming from a new network, a visitor on a shared IP getting their own cart, cookies for another shop or for an ended or missing session, and the expiry extension.
- **Docs.** The cookie format note in `TRAFFIC_SCALING_V2_IMPLEMENTATION.md`, its index and test tables, `TESTING_GUIDE.md` F4, and the `ipAddress` description in `firestore_schema_blueprint.json` are updated.
- **Dev note.** `apps/server/.env*` sets no `PRINT_USER_COOKIE_SECRET` for local dev, so each server restart picks a new key, and every guest cookie stops working. Resume-by-IP used to hide this, because every dev visitor was `127.0.0.1`. Now a restart gives each visitor a new empty cart. Set a 32+ character `PRINT_USER_COOKIE_SECRET` in `apps/server/.env.local` to keep carts across restarts.
- **Not verified.** The web client's 401 restart has no automated test; the web app has no test runner. Check it by hand: restart the dev server without a fixed secret, then act in an open cart.

### Phase 3: Web app upload UX (W1–W9) — DONE (code; not yet exercised in a browser)

What was built:

- **Abortable uploads.**
  - `uploadToPresignedUrl` and `uploadGuestFile` take an `AbortSignal`, and the retry waits honour it too.
  - A cancel at any step throws `UploadCancelledError` and deletes the intent, including one that arrives after the cancel.
  - The upload page creates one `AbortController` per picked file before it starts, so Cancel and Clear all also stop files that are still queued.
- **Upload page** (`app/s/[slug]/page.tsx`, `components/documents-upload-card.tsx`, new `components/upload-file-list.tsx`):
  - **File list.** It shows every document with its state, a per-file Remove (or Cancel while uploading), Retry on failed files, and Clear all with an inline confirm.
  - **Continue.** It is the primary button whenever at least one document is READY and nothing is uploading, clearing or being removed. Upload More becomes the outlined secondary.
  - **Auto-continue.** It only fires after an upload batch that landed in full. Removing, clearing, cancelling, a failure, or arriving with a restored cart never triggers it.
  - **Drawer Cancel.** "Cancel Upload" now aborts the uploads.
  - **Cap after restore.** Picking is disabled until the cart has loaded, so the 10-file cap counts what is already in it.
- **Awaited deletes.** The upload page, customize and review now await each delete.
  - The document is removed optimistically.
  - On failure it goes back where it was and a message is shown; review reloads the order, as it already did for other edits.
  - `ALREADY_ORDERED` says the document is already in the order and re-reads the cart.
  - Customize keeps Continue disabled while a delete is pending.
- **Cache hygiene.**
  - `file-store.ts` reuses one IndexedDB connection and stamps entries with `cachedAt`.
  - Entries older than 12 h are pruned when the store first opens.
  - `removeCachedFile(s)` runs after a successful delete and after Clear all.
  - `lib/local-cart.ts` `clearStoredCart()` drops the sessionStorage cart copies after Clear all and once an order is placed (in `submitGuestOrder`).
  - Files of placed orders stay cached for the tracking page until they are pruned.
- **Stale fallbacks removed.**
  - Customize keeps Continue disabled until the server cart has been read, and says so if the read fails.
  - Review's `loadOrderDraft` no longer falls back to sessionStorage documents; a failed read shows the existing error and retry.
  - The local price estimate uses the shop's own rates (`shop.pricing`) rather than a hard-coded colour rate.

The original Phase 3 plan:

- **Upload controller.** Add a small module (`lib/upload-controller.ts`) that owns one `AbortController` per upload:
  - `uploadToPresignedUrl` accepts a `signal` and calls `xhr.abort()`.
  - `uploadGuestFile` accepts a `signal` and checks it between the intent, PUT and complete steps.
  - On abort, it deletes the intent and returns a typed `cancelled` result rather than an error.
  - A cancelled upload whose intent comes back late is deleted when it arrives.
- **Upload page** (`app/s/[slug]/page.tsx`, `components/documents-upload-card.tsx`):
  - Show a compact file list below the CTA, built from `@ctrlp/ui` components and the design tokens, with per-file Remove and per-error Retry.
  - Add **Clear all**, guarded by a confirm dialog.
  - Show an explicit **Continue** button whenever at least one document is READY and none are uploading.
  - Auto-continue only when the round finished with no errors.
  - `handleCancelUpload` aborts the uploads, rather than calling `onRemoveFile`.
  - Error rows never block continuing; the user can remove or retry them.
- **Awaited deletes everywhere** (upload page, customize `removeSelected`, review). The flow is:
  1. Remove the document optimistically.
  2. On failure, restore it and show a toast.
  3. Re-read the cart with `loadGuestSession({ fresh: true })`.
  4. If the result is `409 ALREADY_ORDERED`, explain that the document is already in the order.
- **One reset helper.** Add `resetLocalCart()` in `lib/file-store.ts` / `lib/cloud.ts`. It deletes the IndexedDB entries, clears `ctrlp-uploaded-files`, `ctrlp-configured-documents` and `ctrlp-order-draft`, and sets `lastSession = null`. Call it after Clear All and after a successful submit. Add `removeCachedFile(id)` for single deletes, and reuse a single IndexedDB connection.
- **Count after restore.** Compute the cap only once the cart has been restored: disable the picker until the first `loadGuestSession` settles, or count against the server list.
- **Stale fallback.** The customize and review pages should not render documents from sessionStorage that the server no longer has. Use sessionStorage only for first paint, and only when it matches the server cart's ids.

### Phase 4: Guest order lifecycle (S3, W10) — DONE (code; not yet exercised in a browser)

- **Guest cancel.**
  - `POST /api/v1/public/session/orders/{orderId}/cancel` calls `cancelGuestOrder`, which uses the new `cancelUnpaidOrder` (`order.service.ts`). It is allowed only for this guest's order while it is `SUBMITTED` and not `PAID`.
  - Refusals: another guest's order is a 403; once the shop has it, `ORDER_NOT_CANCELLABLE`; once paid, `ORDER_ALREADY_PAID`. Cancelling an order that is already cancelled is a no-op.
  - It goes through `applyOrderChange`, so the tracking copy and board deltas update, and it records `cancellation.reason`.
  - The files are deleted at once with the new `shredAllOrderDocuments` (`document.service.ts`). If a delete fails, the dropped-order sweep tries it again.
- **Late payments.** `confirmOnlinePayment` now refuses a cancelled order with `409 ORDER_CANCELLED`. A real gateway's late callback would need a refund flow, which is not built.
- **Payment retry.**
  - The review page keeps the placed order's transaction after a failed payment. Retry pays that same order and does not submit again, and cash is turned off while that online order is pending.
  - The idempotency key is stable for each set of cart documents and payment method (`checkoutIdempotencyKey`, stored in sessionStorage).
  - After a submit fails with no answer, the page re-reads the cart. If the cart is empty and `activeOrderId` is set, it opens that order instead of showing an error.
  - After a reload with an unfinished online order and an empty cart, review redirects to that order's page. This replaces the transaction restore that could never match.
- **Order-status page.** The new `components/tracking/order-pending-actions.tsx` offers:
  - **Pay now** for an unpaid online order. It uses `payPlacedOrder`, the same mock payment the review page uses, so it only works where `ALLOW_MOCK_PAYMENTS=1`.
  - **Cancel order**, with an inline confirm, for any unpaid `SUBMITTED` order.
- **Unpaid sweep.**
  - Step 4 of `runDailyMaintenance` cancels `ONLINE` orders that are still `SUBMITTED` and `PENDING` 30 minutes after checkout (`PAYMENT_TIMEOUT`), and deletes their files.
  - The summary now reports `unpaidOrdersCancelled`.
  - The sweep's query needs the new collection-group index in `packages/firebase/firestore.indexes.json`. Until that index is deployed, the step logs and skips, and the other clean-up steps still run.
- **Board.**
  - `isAwaitingOnlinePayment` (`board-model.ts`) keeps unpaid online orders out of both the full board and deltas, so a shop never sees work it can't start.
  - An online checkout no longer rings `order_submitted`; the payment rings when it lands.
  - The print-shop UI was not changed, because the desktop session owns those files.
- **Tests.** Emulator tests cover guest cancel: success with tracking and shredding, idempotency, cash orders, refusals, and a late payment refused. They also cover the sweep (only stale, unpaid, still-SUBMITTED online orders are cancelled) and board hiding in both full and delta reads. There is also a unit test for `isAwaitingOnlinePayment`.
- **Known gaps.**
  - Once an online order is placed, it can't be switched to cash.
  - The sweep runs only as often as the daily cron, so a stale unpaid order is cancelled up to a day late. It is hidden from the shop in the meantime.
  - Deploy the new index: `firebase deploy --only firestore:indexes`.

### Phase 5: Job pipeline alignment (J1–J4) — DONE on the server; agent and shop UI consumption open

- **One page-selection parser.**
  - The parser lives in `packages/schemas/src/page-selection.ts`, exported as `@ctrlp/schemas/page-selection` with no zod import, and is unit-tested.
  - It is strict: a token that is out of range or malformed fails the whole selection. It returns the pages and a canonical form (`"all"` or `"1,3,5-8"`).
  - The cart validator (`print-user.helpers.ts`) and the dispatcher (`printing/page-selection.ts`) both use it.
  - The cart stores the canonical form. Checkout re-reads every document with it, bills exactly the pages that will print, and refuses a selection saved before the grammar became strict (`<file>: use valid pages …`).
  - The web app's own `lib/page-selection.ts` and `components/customize/page-selection-control.tsx` are not used anywhere. Replace them with the shared module once a page-selection UI ships.
- **Orientation.** It is carried through `PrintUserCheckoutDocument`, the order's `documents[].config.orientation`, the `queueIncomingOrder` overrides, the dispatch override schema, and `PrintSettings`/`asSettings`. So `resolvedSettings.orientation` is now set, and the agent's executor already reads it. Orders placed before this change carry no orientation and keep the printer's preset.
- **Queue failures.**
  - `queueIncomingOrder` writes `queueErrors[{documentId, code, message, at}]` on the order, rings the shop, and returns `{ failures }`. A later run that queues everything clears the list, and so does a successful manual dispatch of that document.
  - `OrderDto.queueErrors` exposes the list to the board.
- **Retry.**
  - `retryPrintJob` refuses with `409 DOCUMENT_MISSING` when the file is gone from the bucket (a HEAD; if storage can't be reached, the retry goes ahead).
  - Inside the transaction it also refuses `DOCUMENT_SHREDDED`, `DOCUMENT_NOT_READY`, `DOCUMENT_NOT_FOUND`, and `ORDER_NOT_ACCEPTED` (an order that no longer prints).
  - Redelivery now bumps `updatedAt`, so board deltas stop showing a stale Rescue.
- **Job cancel.** `POST /api/v1/shops/{shopId}/orders/{orderId}/jobs/{jobId}/cancel` calls `cancelPrintJob`.
  - It cancels a QUEUED or FAILED job, or a claimed job whose PC has been quiet for 15 minutes (the rescue rule, `decideCancel`). A job a live PC holds is refused with `PRINT_JOB_STILL_ACTIVE`, and cancelling an already cancelled job is a no-op.
  - It clears the lease, so a late report gets `lease_mismatch`, and it rings `work` when a PC held the job.
  - The document stays dispatchable.
- **Revocations.**
  - The sync body takes `held: [{orderId, jobId, leaseId}]` (`syncAgentRequestSchema`; an empty body is still fine).
  - `SyncAgentResponse.revoked` lists the held leases to drop, each with `CANCELLED`, `RESCUED`, `FINISHED` or `NOT_FOUND` (`revokedReason`).
  - These are computed before claiming, so a job re-queued onto the same PC comes back revoked under its old lease and claimed under a new one.
- **Tests.**
  - Emulator tests (70 in total):
    - landscape and the chosen pages reaching the job in canonical form
    - cart and checkout refusals for out-of-range selections
    - queue failures recorded and then cleared
    - retry refusals (missing, shredded, order not printing)
    - job cancel rules
    - revocation for every reason, including another PC naming the lease
  - Unit tests for `decideCancel`, `revokedReason` and the parser.
  - The fake S3 in `test/emulator/harness.ts` now answers HEAD.
- **Still open.**
  - The C# agent must send `held` and act on `revoked`: drop the local row without printing or reporting. The shop UI should show `queueErrors` and offer Cancel on a job. Until then the server features are inert, but backward compatible.
  - Two items from the original Phase 5 plan were not built: cancelling an order from `SHOP_ACCEPTED`/`PRINTING`, and hiding FAILED jobs of finished orders from the board.

### Phase 6: Desktop agent and shop UI (D1–D6) — DONE

Built in a separate session on `claude/stoic-hermann-5211ac` (commits `333a3e7` and `554bd22`) and merged into `fix/upload`. Agent tests pass 100/100, shop tests 50/50, and the shop typecheck is clean.

- **Queue and leases.**
  - The local queue is scoped to the signed-in shop and agent.
  - Files are staged per lease, and staged files of failed and cancelled jobs are cleaned up.
  - Local Retry and Cancel on cloud jobs go through the server.
- **Report safety.** `pagesPrinted` is clamped, and a rejected batch is retried one report at a time. `PagesTotal` is nullable.
- **Shop UI.** It shows "Printing" for claimed cloud jobs and hides Cancel while one is printing.
- **Phase 5 contract, on the agent side.**
  - Sync sends `held`, and `revoked` is applied before `claimed`: the job is never printed if it hasn't started, and never reported.
  - The shop UI offers Cancel through the new endpoint. While a live PC holds the job, it falls back to a local cancel, which the agent then reports under its own lease.
  - The shop UI shows `queueErrors`.
- **Server side of report safety** (in this checkout):
  - Each report in a batch is parsed on its own. One the server can't read is answered `invalid_state`, which the agent treats as final rather than retrying.
  - An over-large `pagesPrinted` is accepted and clamped to the job's page total.
  - `errorCode` and `errorMessage` are trimmed and cut to length instead of failing the report.

The original Phase 6 plan:

- **Scope the local queue.** Add a SQLite migration with `shop_id` and `agent_id` columns, and filter `ClaimNext` to the signed-in shop and agent.
- **Stage per lease:** `jobs/{jobId}/{leaseId}/document.ext`. Clean up staged files for failed and cancelled jobs.
- **Local actions go through the server.** Local Retry and Cancel on a cloud job call the server's retry/cancel endpoints and never reuse a lease. Apply the `revoked` list from sync.
- **Report and sync safety.** Clamp `pagesPrinted` to the schema maximum, and validate each report so one bad report can't fail the batch (server side: per-report parse). Make `PagesTotal` nullable or defaulted.
- **Shop UI.** Show "Printing" for claimed cloud jobs, and hide Cancel while a job is printing.

### Phase 7: Verification

- **Unit tests:** the shared page-selection parser, the cookie, the cart reducer, and the checkout transaction.
- **Emulator tests** (the `apps/server/test/emulator` pattern): the checkout and delete races, clear all, guest cancel, the unpaid sweep, and retry on a shredded document.
- **Agent tests** (`apps/print-agent/tests`): shop-scoped `ClaimNext`, per-lease staging, and the `pagesPrinted` clamp.
- **Manual end-to-end:** run the matrix below on a phone, switching between Wi-Fi and 4G mid-flow.

## 7. Edge-case matrix (acceptance)

| Scenario | Expected after the fix |
|---|---|
| Pick 3 files, tap Cancel Upload at 40% | XHRs aborted, intents deleted, drawer closes, cart unchanged |
| 1 of 3 files fails | List shows the failed row with Retry/Remove; Continue enabled for the 2 READY |
| Reload with 3 documents in the cart | Same 3 shown with Remove, Clear all and Continue; previews restored from IndexedDB where present |
| Clear all while one file is mid-upload | Upload aborted; server cart empty; late intent deleted; IndexedDB and sessionStorage empty |
| Delete fails (offline or 5xx) | Row restored, toast shown, cart re-read |
| Delete a document that was just ordered (other tab) | 409 → "Already in your order", nothing deleted from storage |
| Phone switches from Wi-Fi to 4G mid-cart | Next request restarts the session once and the same cart continues |
| Two people on the shop Wi-Fi scan the QR | Each gets their own empty cart |
| Online payment fails, then Retry | Same order is retried; no 400 and no duplicate order |
| Customer abandons an unpaid order | Customer can cancel it; otherwise auto-cancelled after the TTL; never shown as work on the board |
| Submit while a file is still uploading | 409 with a clear message; nothing is silently left behind |
| Page selection `1,200` on 10 pages | Rejected at customize time; never reaches dispatch |
| LANDSCAPE chosen | Job `resolvedSettings.orientation = LANDSCAPE`; printed landscape |
| Shop PC signs out with queued local jobs | They do not print under another shop; reconciled on the next sign-in |
| Operator rescues a job that is still in the local queue | Old lease is revoked through sync; it prints once |

## 8. Data and schema changes

| Store | Change |
|---|---|
| `printUsers/{id}` | `documents` is emptied atomically at checkout and by Clear All (Phase 1). `ipAddress` is kept for logging only. Cookie format moves to `v2` (no IP tag). |
| `shops/{shop}/orders/{id}.documents[].config` | `orientation` (new). Canonical `pageSelection`. |
| `shops/{shop}/orders/{id}` | `queueErrors[]` (new). Guest cancel writes `CANCELLED` + `lifecycle.cancelledAt`. |
| `…/printJobs/{id}` | Real use of `CANCELLED`, plus `cancelledAt`/`cancelReason`. Redelivery bumps `updatedAt`. |
| `packages/schemas` | Clear-cart response, guest cancel request, `orientation` in dispatch overrides, shared page-selection parser, `SyncAgentResponse.revoked`. |
| Firestore indexes | `orders`: `payment.method + status + payment.status + createdAt` for the unpaid sweep. |
| Agent SQLite | `jobs.shop_id`, `jobs.agent_id`, `jobs.lease_id` used in the staging path. |

## 9. Suggested order and size

Phases 1 and 2 are prerequisites, because the UI work relies on their contracts. Phase 3 can start against the Phase 1 API shape. Phases 5 and 6 are independent of 3 and 4, and can run in parallel in their own branches.

| Phase | Area | Rough size |
|---|---|---|
| 1 | server cart and checkout | M |
| 2 | session identity | S |
| 3 | web upload UX | L |
| 4 | guest order lifecycle | M |
| 5 | job pipeline | M |
| 6 | desktop agent and UI | M–L |
| 7 | tests | spread across phases |
