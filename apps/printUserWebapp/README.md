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
- **Concurrency and retry:** up to 3 files upload at a time, and a failed storage `PUT` is retried once.
- **Cleanup:** if an upload fails after the intent was created, the intent is deleted so it doesn't hold a cart slot.

Other behaviour to keep:

- **Continue:** Continue is blocked while any upload is still running. A file that finishes later would be ordered without being shown.
- **Saving settings:** customize saves all document settings with one batch `PUT`.
- **Review edits:** copy changes and deletes on the review page are written to the server in order, then re-quoted. Pay waits for those writes before comparing prices.

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
