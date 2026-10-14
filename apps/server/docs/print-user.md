# Guest print-user API

The customer web app ([`apps/printUserWebapp`](../../printUserWebapp)) calls these routes through its `/api` proxy. A guest has no account. Each guest session is a cart bound to one shop by the `ctrlp_print_user` cookie and the client IP. It lasts 12 hours and is stored at `printUsers/{printUserId}`.

All JSON. Errors: `{ "error": "message" }`.

## Routes

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/public/shops/{slug}` | — | `{ shop }` |
| POST | `/api/v1/public/shops/{slug}/session` | — | `{ session, shop }`. Creates or resumes the session and sets the cookie. |
| GET | `/api/v1/public/session` | — | `{ session }`, including the cart in `session.documents` |
| POST | `/api/v1/public/session/documents` | `{ originalFilename, mimeType, fileSizeBytes }` | `{ document, uploadUrl, storageKey, expiresIn }` |
| PUT | `/api/v1/public/session/documents` | `{ documents: [{ documentId, colorMode, copies, paperSize, orientation?, pageSelection }] }`, 1 to 10 entries | `{ documents }` |
| POST | `/api/v1/public/session/documents/{docId}/complete` | — | the `READY` document |
| PUT | `/api/v1/public/session/documents/{docId}` | `{ colorMode, copies, paperSize, orientation?, pageSelection }` | `{ document }` |
| DELETE | `/api/v1/public/session/documents/{docId}` | — | `{ ok: true }` |
| POST | `/api/v1/public/session/quote` | — | price quote for every `READY` document |
| POST | `/api/v1/public/session/orders` | `{ paymentMethod, idempotencyKey, expectedTotalPaise? }` | `{ priceChanged, quote, order }` |
| GET | `/api/v1/public/session/orders/{orderId}` | — | the order |
| POST | `/api/v1/public/session/orders/{orderId}/payments/mock-confirm` | `{ idempotencyKey }` | the order |

`pageSelection` is `{ mode: "all" }` or `{ mode: "selected", expression: "1,3,5-8" }`.

## Uploading one file

1. `POST .../documents` adds an `UPLOADING` document to the cart and returns a presigned storage URL that lasts 15 minutes.
2. The browser `PUT`s the file straight to storage with the returned `document.mimeType` as `Content-Type`.
3. `POST .../documents/{docId}/complete` reads the object back, checks the file signature, counts pages, and stores the SHA-256. The document becomes `READY`.

Accepted types are PDF, JPEG, and PNG, up to 50 MB each. The server picks the type from `mimeType`, then from the file extension.

## Cart rules

- A cart holds at most 10 live documents. `FAILED` documents and `UPLOADING` intents older than 20 minutes do not count. The next upload removes them and their storage objects.
- When `complete` finds the file unreadable, it removes the document and its storage object, then returns 400. Unreadable means not a real PDF, JPEG, or PNG, a password-protected PDF, a PDF with no pages, or a file over 50 MB.
- When presigning fails, the new intent is removed.
- Placing an order removes the submitted documents from the cart and records the order in `activeOrderId`. The next order in the same session starts empty.
- A submit retried with the same `idempotencyKey` returns the original order, even though the cart is already empty. It also clears the cart if the first attempt failed before doing so.
- Use the batch `PUT .../documents` to save settings for the whole cart in one write. The single-document `PUT` is for one change, such as copies on the review page.

### Why writes are shaped this way

Every cart change is a read-modify-write of one Firestore document (`mutatePrintUserDocuments`, up to 10 transaction attempts). Parallel uploads all touch that document, so the server keeps other writes to it rare:

- Each request extends the session expiry at most once a minute (`shouldTouchSession`), not on every call.
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
pnpm --filter server test
```

This runs the print-user helper tests and the PDF page-count tests. None of them call Firestore or storage.
