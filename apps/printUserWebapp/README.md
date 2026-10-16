# Print User Web App

Next.js customer-facing app: find a shop by slug or QR, upload documents, customize print options, pay, and track order status.

- **API:** `NEXT_PUBLIC_API_BASE_URL` → [`apps/server`](../server) (default `http://localhost:3000`).
- **Port:** `3002` (`pnpm webapp:dev` from repo root).
- **UI:** Shared design system via [`@ctrlp/ui`](../../packages/ui). See root [`AGENTS.md`](../../AGENTS.md).

Monorepo onboarding: [`README.md`](../../README.md).

## Setup

```powershell
# from repo root
pnpm install
copy apps\printUserWebapp\.env.example apps\printUserWebapp\.env.local
pnpm server:dev    # separate terminal
pnpm webapp:dev
```

Ensure server `PRINT_USER_ORIGIN` matches your web app origin (e.g. `http://localhost:3002`).

Production runs on Firebase App Hosting (backend `ctrlp-web`, config in [`apphosting.yaml`](./apphosting.yaml)). The `NEXT_PUBLIC_*` values are built into the app, so a change needs a new rollout. Deploy steps: [`apps/server/docs/deployment.md`](../server/docs/deployment.md). Env blocks: [`docs/deploy/ENVIRONMENT.md`](../../docs/deploy/ENVIRONMENT.md), section 2.

## Layout

```text
src/app/           App Router pages (shop slug, customize, review, payment, tracking)
src/components/    Feature UI
src/lib/           API client (cloud.ts), uploads (guest-upload.ts), formatters
src/hooks/         Client hooks (e.g. payment)
```

## Uploads and the guest cart

The server cart (`GET /api/v1/public/session`) is the only source of truth for which documents an order will contain. The upload, customize, and review pages all load the list from it. `sessionStorage` only speeds up the first paint and keeps unsaved settings for documents that are still in the cart. Server rules are in [`apps/server/docs/print-user.md`](../server/docs/print-user.md).

[`src/lib/guest-upload.ts`](src/lib/guest-upload.ts) is the one upload path for both the upload and customize pages:

- **Checks before uploading:** files are checked for type, size (50 MB), and the 10-document limit. Type is read from the MIME type or extension, or from the first bytes for gallery files that have neither.
- **Gallery photos:** HEIC, WebP, GIF, AVIF, and BMP are converted to JPEG in the browser when it can decode them (longest edge 4000 px).
- **Concurrency:** up to 3 files upload at a time.
- **Retries:**
  - A failed storage `PUT` is retried once.
  - The server's file check (`complete`) is retried up to 3 times (after 1 s, then 2 s) on a dropped connection, 408, 429, or 5xx. The server is serverless, so these happen during cold starts and scaling. A 400 is final.
- **Cleanup:** if an upload fails after the intent was created, the intent is deleted so it doesn't hold a cart slot.
- **Cancelling:** `uploadGuestFile` takes an `AbortSignal`. A cancel at any step aborts the storage `PUT`, deletes the intent (also one created after the cancel), and throws `UploadCancelledError`, which the pages don't show as a failure.
- **Deleting:** deletes are awaited. The page removes the document at once and puts it back with a message if the server refuses. `ALREADY_ORDERED` (409) means it is already in the order. `deleteGuestDocument` is idempotent, and `clearGuestCart` empties the server cart.
- **Session:** a 401 from a cart route restarts the shop session once and retries (`lib/cloud.ts`).
- **Caches:**
  - Previews are kept in IndexedDB ([`src/lib/file-store.ts`](src/lib/file-store.ts)), pruned after 12 hours and dropped on delete or Clear all.
  - `clearStoredCart` ([`src/lib/local-cart.ts`](src/lib/local-cart.ts)) clears the sessionStorage copies after Clear all and once an order is placed.

API errors are thrown as `ApiError` (from [`src/lib/cloud.ts`](src/lib/cloud.ts)), which carries the HTTP `status`.

### Upload page

[`src/app/s/[slug]/page.tsx`](src/app/s/[slug]/page.tsx), [`src/components/documents-upload-card.tsx`](src/components/documents-upload-card.tsx) and [`src/components/upload-file-list.tsx`](src/components/upload-file-list.tsx):

- **The list:** every document in the server cart (after a reload too) and every file picked on this visit is shown, with its state.
  - **Remove** works on any document; while one is uploading it reads **Cancel**.
  - **Retry** appears on a failed upload.
  - **Clear all** asks for confirmation. It then stops every upload and empties the server cart.
- **Continue:** the green primary button shows whenever at least one document is in the cart and nothing is uploading, clearing or being removed. **Upload More Documents** becomes the lime outlined button.
- **Moving on by itself:** only after an upload batch that landed in full, about 0.7 s later. Removing, clearing, cancelling, a failure, or arriving with a restored cart never moves the page on.
- **Cancel Upload:** the drawer's button aborts every upload in flight or queued, and the files leave the list.
- **Cap:** picking waits until the cart has loaded, so the 10-document limit counts what is already in it.
- **Progress drawer:** it shows one percentage for all files in the round, weighted by file size. A retry started mid-round joins that round. The bar stops at 99% until the server has checked every file, and reads **Checking documents…** once all bytes are in storage.
Other behaviour to keep:

- **Continue on customize:** Continue is blocked while an upload or a delete is still running, and until the server cart has been read. A file that finishes later would be ordered without being shown; a stale first paint could list documents that are gone.
- **Saving settings:** customize saves all document settings with one batch `PUT`.
- **Review edits:** copy changes and deletes on the review page are written to the server in order, then re-quoted. Pay waits for those writes before comparing prices. A failed write reloads the order from the server cart. Review never falls back to sessionStorage documents.
- **Payment retry:** a failed online payment keeps its placed order; **Try Again** pays that same order, and cash is off for it.
  - The idempotency key stays the same for the same documents and method, so a submit after a lost response replays the original order.
  - If a submit fails with no answer and the cart turns out empty, the page opens the placed order.
- **Order page:** for an unpaid `SUBMITTED` order, [`src/components/tracking/order-pending-actions.tsx`](src/components/tracking/order-pending-actions.tsx) offers **Pay now** (online) and **Cancel order**.

How the whole flow fits together, including the server and the desktop agent: [`docs/arc/UPLOAD_ORDER_SYNC.md`](../../docs/arc/UPLOAD_ORDER_SYNC.md).

## Shop hours

Shop hours are shown exactly as the server sends them: `todayHoursLabel`, `openStatusLabel`, and a 12-hour `label` for each day. The server computes them in shop time, so never derive hours from the phone's clock. The shop info drawer lists the whole week. Uploading is disabled while the shop is closed.

## Commands (repo root)

| Script | Purpose |
| --- | --- |
| `pnpm webapp:dev` | Dev server |
| `pnpm webapp:build` / `webapp:start` | Production build |
| `pnpm webapp:typecheck` / `webapp:lint` | Quality gates |

## Adding shared components

Add shadcn primitives to the shared package, not inside this app:

```bash
pnpm --filter @ctrlp/ui exec shadcn add button
```

Use in the app:

```tsx
import { Button } from "@ctrlp/ui/button";
```
