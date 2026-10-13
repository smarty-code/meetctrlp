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
src/lib/           API client helpers, formatters
src/hooks/         Client hooks (e.g. payment)
```

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
