# Server

Next.js **API-only** backend (App Router route handlers). No customer-facing page shell in this app; browsers use [`apps/printUserWebapp`](../printUserWebapp) and the shop uses [`apps/print-shop`](../print-shop).

**Data:** Firebase Authentication + Firestore. Uploaded print files go to S3-compatible object storage configured in env.

Monorepo onboarding: [`README.md`](../../README.md).

## Structure

| Path | Role |
| --- | --- |
| `app/api/` | HTTP routes (`/api/auth/*`, `/api/v1/*`, health) |
| `src/config/` | Environment and app configuration |
| `src/lib/` | HTTP helpers, CORS, shared infrastructure |
| `src/modules/` | Domain features (orders, shops, devices, print-user, …) |
| `src/types/` | Server-only types |
| `src/utils/` | Small utilities |

## Setup

```powershell
# from repo root
copy apps\server\.env.example apps\server\.env.local
# fill Firebase, S3, PRINT_USER_ORIGIN, etc.
pnpm server:dev
```

```bash
curl http://localhost:3000/api/health
```

See [`docs/auth.md`](./docs/auth.md) for shop-owner registration, login, refresh, devices, and shop settings APIs.
See [`docs/print-user.md`](./docs/print-user.md) for the guest customer session, upload, cart, and checkout APIs.

## Commands (repo root)

| Script | Purpose |
| --- | --- |
| `pnpm server:dev` | `next dev` (port 3000) |
| `pnpm server:build` / `server:start` | Production |
| `pnpm server:typecheck` / `server:lint` | Quality gates |

## Related packages

- [`@ctrlp/firebase`](../../packages/firebase) — Admin SDK wiring
- [`@ctrlp/schemas`](../../packages/schemas) — Shared validation
- [`@ctrlp/types`](../../packages/types) — Shared types
