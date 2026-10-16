# Guest print-user API

The customer web app ([`apps/printUserWebapp`](../../printUserWebapp)) calls these routes through its `/api` proxy. A guest has no account. Each guest session is a cart bound to one shop by the `ctrlp_print_user` cookie. The cookie alone identifies the guest; the client IP plays no part. It lasts 12 hours from the last activity and is stored at `printUsers/{printUserId}`.

## The guest cookie

The cookie is signed, so the server knows the guest without reading Firestore:

```text
v2.<printUserId>.<shopId>.<expiresAtSeconds>.<hmac>
```

- `hmac` is an HMAC-SHA256 over the rest with `PRINT_USER_COOKIE_SECRET` ([`deployment.md`](./deployment.md#environment-variables)). Development without the variable uses a per-process secret, so a dev-server restart starts guests over.
- **Not bound to the network.** A phone that moves between Wi-Fi and mobile data keeps its cart. Two visitors on one network (shop Wi-Fi, carrier NAT) never share one. A cookie in the older `v1` format, which carried an IP tag, still verifies until it expires, with its tag ignored; the next re-issue writes `v2`.
- **The client IP.** It is recorded on a new session (`ipAddress`) for abuse logging only. Behind the web app's `/api` proxy the API reads it from `x-ctrlp-client-ip`, trusted only when `x-ctrlp-proxy-secret` matches `CTRLP_PROXY_SECRET`; otherwise from the first `X-Forwarded-For` entry.
- **Bad cookies.** An expired, tampered or unknown-format cookie gets 401 on cart routes. The web app then starts the shop session again, once, and retries; with no valid cookie that is a new, empty cart.
- **Session start.** It resumes only the cookie's own session, and only for the same shop while it is unexpired. Anything else starts a new cart; nothing is looked up by IP.
- **Sliding expiry:** once the cookie is more than an hour old, the next request re-issues it with a fresh 12 hours and writes the session's new `expiresAt` (one write an hour at most). Cart writes set `expiresAt` too.
- Routes that need the cart (`GET /public/session`, quote, order submit, uploads) read `printUsers/{printUserId}` once. Routes that don't (order tracking, mock confirm) don't read it at all.

Code: [`src/modules/print-user/print-user-cookie.ts`](../src/modules/print-user/print-user-cookie.ts) (pure, tested in `print-user-cookie.test.ts`), `print-user-http.ts` (`readGuestPrincipal`, `requirePrintUserSession`, `runPrintUser`) and `print-user-session.service.ts` (`createOrResumePrintUserSession`).

All JSON. Errors: `{ "error": "message" }`.

## Routes

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/public/shops/{slug}` | — | `{ shop }` |
| POST | `/api/v1/public/shops/{slug}/session` | — | `{ session, shop, firebaseToken }`. Creates or resumes the session and sets the cookie. `firebaseToken` is a Firebase custom token for uid = `printUserId`, used only by the tracking page to read its own `orderTracking` documents; it is `null` if signing failed. |
| GET | `/api/v1/public/session` | — | `{ session }`, including the cart in `session.documents`. Documents carry no `storageKey`, and the session no IP. |
| POST | `/api/v1/public/session/documents` | `{ originalFilename, mimeType, fileSizeBytes }` | `{ document, uploadUrl, storageKey, expiresIn }` |
| PUT | `/api/v1/public/session/documents` | `{ documents: [{ documentId, colorMode, copies, paperSize, orientation?, pageSelection }] }`, 1 to 10 entries | `{ documents }` |
| POST | `/api/v1/public/session/documents/{docId}/complete` | — | the `READY` document |
| PUT | `/api/v1/public/session/documents/{docId}` | `{ colorMode, copies, paperSize, orientation?, pageSelection }` | `{ document }` |
| DELETE | `/api/v1/public/session/documents/{docId}` | — | `{ ok: true, removed }`. `removed` is `false` when the document was already gone. `409 ALREADY_ORDERED` when it is in the guest's order. |
| DELETE | `/api/v1/public/session/documents` | — | `{ ok: true, removed }`: **Clear all**. Every cart entry (ready, uploading, failed) leaves in one transaction, then the files are deleted. A placed order is not touched. |
| POST | `/api/v1/public/session/quote` | — | price quote for every `READY` document |
| POST | `/api/v1/public/session/orders` | `{ paymentMethod, idempotencyKey, expectedTotalPaise? }` | `{ priceChanged, quote, order }`. `409 DOCUMENTS_STILL_UPLOADING` while a cart file is still uploading. |
| GET | `/api/v1/public/session/orders/{orderId}` | — | the order's tracking copy (below). The tracking page's fallback when its live listener isn't available. |
| POST | `/api/v1/public/session/orders/{orderId}/cancel` | — | the tracking copy. Allowed while the order is `SUBMITTED` and unpaid. Its files are deleted at once. `409 ORDER_NOT_CANCELLABLE` once the shop has it, `409 ORDER_ALREADY_PAID` once paid, 403 for another guest's order. |
| POST | `/api/v1/public/session/orders/{orderId}/payments/mock-confirm` | `{ idempotencyKey }` | the order. `409 ORDER_CANCELLED` for a cancelled order. |

`pageSelection` is `{ mode: "all" }` or `{ mode: "selected", expression: "1,3,5-8" }`.

- **Parsing.** The expression is read with the shared strict grammar ([`@ctrlp/schemas/page-selection`](../../../packages/schemas/src/page-selection.ts)): any token outside the document, or malformed, refuses the whole selection with 400.
- **Storage.** The cart stores it in canonical form (`" 5-8, 1 ,3"` becomes `"1,3,5-8"`), so the printer reads exactly what was billed.
- **Orientation.** `orientation` is carried into the order and on to the printer.

## Order tracking

Every guest order (`channel: "PRINT_USER"`) has a customer-safe copy at `orderTracking/{orderId}`, written in the same transaction as each change to the order. The tracking page signs in with `firebaseToken` and listens to that document, so status changes reach the customer with no API requests. Firestore rules let a guest read only a copy whose `printUserId` is their own uid.

```text
{ orderId, shopId, printUserId, orderNumber, pickupCode, status,
  payment: { method, status }, totalPaise,
  items: [{ name, pageCount, billablePages, copies, colorMode, paperSize, totalPaise, mimeType }],
  rejectionReason,
  times: { submittedAt, paidAt, acceptedAt, printingAt, readyAt, completedAt, rejectedAt, cancelledAt },
  updatedAt }
```

It holds no staff IDs, payment references, storage keys or phone numbers. The `GET .../orders/{orderId}` route returns the same shape with times as ISO strings. Copies of orders that finished more than 30 days ago are removed by the daily clean-up.

## Uploading one file

1. `POST .../documents` adds an `UPLOADING` document to the cart and returns a presigned storage URL that lasts 15 minutes.
2. The browser `PUT`s the file straight to storage with the returned `document.mimeType` as `Content-Type`. The file never passes through the server.
3. `POST .../documents/{docId}/complete` checks the file and makes the document `READY`:
   1. It reads the stored object's size without downloading it. A file over 50 MB is removed and gets a 400, because a presigned `PUT` doesn't limit the body size.
   2. It downloads the object, checks the file signature, counts pages, and stores the SHA-256.

To cancel, the web app aborts the `PUT` and deletes the intent with `DELETE …/documents/{docId}`. An intent that is created after the cancel is deleted as soon as it arrives.

Accepted types are PDF, JPEG, and PNG, up to 50 MB each. The server picks the type from `mimeType`, then from the file extension.

`complete` is idempotent: calling it again for a `READY` document returns that document. Its errors tell the client whether to retry:

| Status | Meaning | Web app |
| --- | --- | --- |
| 400 | The object is missing, or the file is unusable (it's also removed). | Shows the error. No retry. |
| 500 | Storage or Firestore failed for a moment. | Retries up to 3 times. |
| 429, 503, 504 | The hosting platform is scaling or timed out. | Retries up to 3 times. |

On Vercel this is the only upload step that runs on the server. See [`deployment.md`](./deployment.md#uploads) for cold starts, memory, and run settings.

## Cart rules

- A cart holds at most 10 live documents. `FAILED` documents and `UPLOADING` intents older than 20 minutes do not count. The next upload removes them and their storage objects.
- When `complete` finds the file unreadable, it removes the document and its storage object, then returns 400. Unreadable means not a real PDF, JPEG, or PNG, a password-protected PDF, a PDF with no pages, or a file over 50 MB. The size is checked before the file is downloaded.
- When presigning fails, the new intent is removed.
- **Checkout is one transaction.** It reads the idempotency key, the shop and the cart, then writes the order and its tracking copy, empties the cart and sets `activeOrderId`. A document is therefore always in the cart or in one order, never both. A delete or Clear all racing the checkout either lands first, and the document isn't ordered, or finds the entry gone and leaves the file alone.
- **What checkout orders.** Every live cart entry must be READY. Abandoned uploads are dropped and their files deleted. Each selection is re-read with the shared grammar, and its pages are what is billed. A selection saved before the grammar was strict is refused with 400.
- **Retried submits.** A submit retried with the same `idempotencyKey` returns the original order, even though the cart is already empty. A key used by another guest gets 409 `IDEMPOTENCY_KEY_REUSED`.
- **Deletes go entry first, then file.** A file is deleted only if its cart entry was still there, so a file an order needs is never deleted from the cart.
- **Unpaid online orders.** A cash order rings the shop at checkout. An online one stays off the shop's board until it is paid. The daily clean-up cancels online orders still unpaid 30 minutes after checkout and deletes their files.
- Use the batch `PUT .../documents` to save settings for the whole cart in one write. The single-document `PUT` is for one change, such as copies on the review page.

### Why writes are shaped this way

Every cart change is a read-modify-write of one Firestore document (`mutatePrintUserDocuments`, up to 10 transaction attempts). Parallel uploads all touch that document, so the server keeps other writes to it rare:

- The session expiry moves at most once an hour (the cookie re-issue), not on every call.
- Settings for the whole cart are saved in one transaction.

The web app also uploads at most 3 files at a time.

## PDF page count

`countPdfPages` in [`src/modules/documents/pdf-page-count.ts`](../src/modules/documents/pdf-page-count.ts) reads `/Count` from the Pages tree that the Catalog points to.

- **Compressed objects:** it reads objects inside FlateDecode object streams too. PDF 1.5+ writers such as Acrobat, Word, pdf-lib, and scanner apps store pages there, where a raw byte scan finds none.
- **Edited files:** when an object is defined more than once, the later definition wins, so incremental edits count correctly.
- **Fallback:** if there's no Catalog, it counts page objects instead.

It has no PDF library dependency. The page count sets the billable pages, so a wrong count means a wrong price.

## Shop hours in `shop`

The public `shop` object includes:

| Field | Example |
| --- | --- |
| `businessHours[]` | `{ dayOfWeek, opensAt: "18:00", closesAt: "02:00", isClosed, isOpen24Hours, label: "6:00 PM – 2:00 AM (next day)" }` |
| `openNow` | `true` |
| `openStatusLabel` | `"Open until 2:00 AM"`, `"Opens tomorrow at 9:00 AM"` |
| `todayHoursLabel` | `"9:00 AM – 9:00 PM"`, `"Open 24 hours"`, `"Closed"` |
| `isOpen24x7` | `false` |

The server computes all of these in Asia/Kolkata with `summarizeBusinessHours` from `@ctrlp/schemas`. The web app shows them as they are and never works out hours itself. See [`packages/schemas/docs/README.md`](../../../packages/schemas/docs/README.md#shop-hours) for the rules.

While the shop is closed, the web app disables uploading. The server does not reject sessions, uploads, or orders outside opening hours.

## Code

- Routes: `app/api/v1/public/**/route.ts`
- Service: `src/modules/print-user/print-user.service.ts`
- Session and cart storage: `src/modules/print-user/print-user-session.service.ts`
- Rules and limits: `src/modules/print-user/print-user.helpers.ts`
- File checks: `src/modules/documents/inspect-document.ts`
- Web app client: `apps/printUserWebapp/src/lib/guest-upload.ts` and `src/lib/cloud.ts`

## Tests

```powershell
pnpm --filter server test:emulator
```

This runs the Firestore emulator suites. `test/emulator/guest-cart.emulator.test.ts` covers:

- checkout, replay, refusals, and abandoned uploads
- delete and Clear all
- guest cancel
- delete and clear racing a checkout

`guest-session.emulator.test.ts` covers the cookie-only identity, and `order-to-job.emulator.test.ts` covers page selection and orientation from the cart to the print job.

The pure tests (cookie, helpers, PDF page count) run with `pnpm --filter server test`. `print-user.helpers.test.ts` needs the emulator suite's resolve hook: `node --experimental-strip-types --experimental-loader ./test/emulator/loader.mjs --test src/modules/print-user/print-user.helpers.test.ts`.

The whole flow, including the desktop side, is described in [`docs/arc/UPLOAD_ORDER_SYNC.md`](../../../docs/arc/UPLOAD_ORDER_SYNC.md).
