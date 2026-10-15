# MeetCtrlP (CtrlP)

Monorepo for **CtrlP**: customers order prints from a shop’s web page; the shop runs a Windows desktop app that talks to the cloud API and prints through a local C# agent.

This document is the onboarding map for new developers. Deeper, area-specific rules live in each app’s `AGENTS.md` and in `docs/`.

---

## How the pieces fit together

```text
Customer (browser / phone)
        │
        ▼
Print User Web App          apps/printUserWebapp   Next.js on :3002
        │  REST (upload, pricing, checkout, tracking)
        ▼
Server API                  apps/server            Next.js API on :3000
        │  Firebase Auth + Firestore + object storage (S3-compatible)
        │
        ├──────────────────────────────────────┐
        ▼                                      ▼
Print Shop Desktop          apps/print-shop      Tauri 2 + React (shop PC)
        │  HTTP (auth, board, orders, printers)       │
        │  invoke → Rust IPC                          │
        ▼                                               │
Print Agent (sidecar)       apps/print-agent     C# named-pipe JSON-RPC
        │                                               │
        ▼                                               │
Windows Print Spooler  →  driver  →  printer
```

| App | Who uses it | Role |
| --- | --- | --- |
| [`apps/printUserWebapp`](apps/printUserWebapp) | End customers | Shop landing, upload, customize, pay, order tracking |
| [`apps/server`](apps/server) | All clients | Authoritative HTTP API, auth, orders, documents, shop config |
| [`apps/print-shop`](apps/print-shop) | Shop staff (Windows) | Login, orders queue, printers, print queue, settings |
| [`apps/print-agent`](apps/print-agent) | Runs on shop PC (sidecar) | Printers, job journal, cloud job lease/stage/print; no UI |

**Important:** Shop desktop is **Tauri + C# sidecar**, not the older WPF app in `apps/desktop-proto`. Architecture source of truth: [`docs/arc/PRINT_SHOP_DESKTOP.md`](docs/arc/PRINT_SHOP_DESKTOP.md).

Shared UI and types:

| Package | Purpose |
| --- | --- |
| [`packages/ui`](packages/ui) | Design system + shadcn components (`@ctrlp/ui`) |
| [`packages/types`](packages/types) | Shared TypeScript types |
| [`packages/schemas`](packages/schemas) | Validation / API shapes |
| [`packages/firebase`](packages/firebase) | Firebase Admin helpers (server-side) |
| [`packages/config`](packages/config) | Prettier and shared tooling config |

Visual rules for any UI work: root [`AGENTS.md`](AGENTS.md) and [`docs/design-system/`](docs/design-system/) (`DESIGN copy.md`, `tokens copy.json`, `variables copy.css`).

---

## Prerequisites

| Tool | Used for |
| --- | --- |
| **Node.js 20+** | Next.js apps, Tauri frontend, tooling |
| **pnpm 11.27** | Package manager (`packageManager` in root `package.json`) |
| **.NET 8 SDK** | Print agent (Windows) |
| **Rust + MSVC** | Tauri shell (Windows only for shop desktop) |

**Windows only** for `pnpm desktop:*` and the print agent. The server and print-user web app run on macOS/Linux for API/UI work; you still need real Windows hardware to exercise printing.

---

## First-time setup

From the repository root:

```powershell
pnpm install
```

### Server (required for almost all flows)

1. Copy [`apps/server/.env.example`](apps/server/.env.example) to `apps/server/.env.local`.
2. Fill Firebase Admin (`FIREBASE_SERVICE_ACCOUNT_BASE64`), Web API key (`FIREBASE_WEB_API_KEY`), the doorbell (`FIREBASE_DATABASE_URL`), storage (`S3_*`), and related values. Every variable, with a copy-paste block per app, is in [`docs/deploy/ENVIRONMENT.md`](docs/deploy/ENVIRONMENT.md).
3. Start the API:

```powershell
pnpm server:dev
```

Health check: `http://localhost:3000/api/health`

### Print User Web App

1. Copy [`apps/printUserWebapp/.env.example`](apps/printUserWebapp/.env.example) to `.env.local` in that app (or set `NEXT_PUBLIC_API_BASE_URL` to your server).
2. Run:

```powershell
pnpm webapp:dev
```

Default: `http://localhost:3002`. Server `PRINT_USER_ORIGIN` should match this in dev.

### Print Shop + Print Agent (shop desktop)

One-time Windows toolchain (winget: .NET 8, Rust, VS Build Tools):

```powershell
pnpm desktop:setup
```

Restart the terminal, then run the full desktop stack (publishes the C# sidecar, then Tauri dev):

```powershell
pnpm desktop:dev
```

Copy [`apps/print-shop/.env.example`](apps/print-shop/.env.example) if you need to point `VITE_SERVER_BASE_URL` at a non-default server.

`pnpm shop:dev` is **Vite-only** UI preview on port 1420. It **cannot** talk to the agent (named pipes are not available in the browser).

Agent-only (no Tauri), useful for RPC debugging:

```powershell
pnpm agent:dev
```

Agent logs: `%LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log`

---

## Scripts cheat sheet (repo root)

| Script | What it does |
| --- | --- |
| `pnpm server:dev` / `server:build` / `server:typecheck` | Backend API |
| `pnpm webapp:dev` / `webapp:build` / `webapp:typecheck` | Customer web app |
| `pnpm desktop:dev` / `desktop:build` | Shop desktop (sidecar + Tauri) |
| `pnpm desktop:setup` | Install Windows desktop toolchains |
| `pnpm agent:test` / `agent:build` / `agent:dev` | C# print agent only |
| `pnpm shop:test` / `shop:typecheck` | Print-shop frontend tests/types |
| `pnpm desktop:test` | Agent tests + shop Vitest |
| `pnpm dev:all` / `build:all` / `typecheck:all` | Turbo across workspaces |

Default `pnpm dev` at the root runs **only** the print-user web app. There is no single command that starts server + webapp + desktop; run them in separate terminals when you need the full loop.

---

## Where to work (by change type)

| You are changing… | Start here | Also read |
| --- | --- | --- |
| Customer flows, upload, payment UI | `apps/printUserWebapp` | Server `print-user` modules, `@ctrlp/ui` |
| HTTP routes, Firestore, auth, orders | `apps/server` | `apps/server/docs/auth.md`, `packages/firebase` |
| Shop screens, Tauri commands | `apps/print-shop` | [`apps/print-shop/AGENTS.md`](apps/print-shop/AGENTS.md) |
| RPC method, queue, Windows print | `apps/print-agent` | [`apps/print-agent/AGENTS.md`](apps/print-agent/AGENTS.md) |
| New agent RPC from UI | Contracts → Core handler → `commands.rs` → `src/lib/agent.ts` | [`docs/arc/PRINT_SHOP_DESKTOP.md`](docs/arc/PRINT_SHOP_DESKTOP.md) §4 |
| Shared button/card/etc. | `packages/ui` | Root `AGENTS.md` (add via shadcn to `@ctrlp/ui`, not per-app copies) |

**Dependency rules (print agent):** `Host → Core → Ipc → Contracts` and `Host → Windows → Contracts`. No Win32 from React.

**Auth model:** Desktop and server-mediated clients use **HTTP to `apps/server`** with refresh tokens stored locally (Credential Manager in the agent/desktop path). There is **no Firebase client SDK** in the shop desktop stack.

---

## App READMEs and handbooks

| Path | Contents |
| --- | --- |
| [`apps/server/README.md`](apps/server/README.md) | Server layout, health endpoint |
| [`apps/server/docs/deployment.md`](apps/server/docs/deployment.md) | Step-by-step deploy: the API on Vercel, the web app on Firebase App Hosting, rules and indexes, the daily cron, the desktop installer, and the test pass after a deploy |
| [`docs/deploy/ENVIRONMENT.md`](docs/deploy/ENVIRONMENT.md) | Every env var for the API, web app and desktop, as copy-paste blocks (local files, the Vercel env, the web app's `apphosting.yaml`), plus the secrets list |
| [`docs/arc/traffic-scaling-v2/README.md`](docs/arc/traffic-scaling-v2/README.md) | The doorbell design: developer and testing guides |
| [`apps/printUserWebapp/README.md`](apps/printUserWebapp/README.md) | Customer app + `@ctrlp/ui` usage |
| [`apps/print-shop/README.md`](apps/print-shop/README.md) | Desktop dev entry |
| [`apps/print-agent/README.md`](apps/print-agent/README.md) | Agent dev entry |
| [`docs/arc/PRINT_SHOP_DESKTOP.md`](docs/arc/PRINT_SHOP_DESKTOP.md) | Protocol, sidecar, commands, debugging |
| [`docs/developer-requirement/desktop-app/CtrlP_Print_Shop_Desktop_MVP_Progress.md`](docs/developer-requirement/desktop-app/CtrlP_Print_Shop_Desktop_MVP_Progress.md) | Desktop MVP checklist |

---

## Suggested local dev flows

**Customer order end-to-end**

1. `pnpm server:dev`
2. `pnpm webapp:dev`
3. Register a shop via server auth (or existing test shop), open the shop slug on :3002, place an order.

**Shop accepts and prints**

1. Keep server running.
2. `pnpm desktop:dev`, sign in as shop owner.
3. The server rings the shop's Realtime Database doorbell on each change. The desktop fetches the board (`/board?since=`); the agent syncs, claims cloud jobs, stages files, submits them to the spooler, and reports results.

**Agent / IPC only**

1. `pnpm agent:dev` with `--pipe ctrlp-print-agent --token dev-token --dev`
2. Use tests in `apps/print-agent/tests` or extend handlers in Core.

---

## Other folders (context only)

| Path | Note |
| --- | --- |
| `apps/desktop-proto` | Older **WPF** prototype; not the shipping shop desktop |
| `docs/developer-requirement/` | PRDs, screen specs, MVP tracking |
| `docs/db/` | Data model notes |

---

## Getting help in the codebase

- **UI look and feel:** `docs/design-system/DESIGN copy.md`
- **Shop-owner auth and device APIs:** `apps/server/docs/auth.md`
- **Deploying (API on Vercel, web app on Firebase App Hosting):** `apps/server/docs/deployment.md`; env vars in `docs/deploy/ENVIRONMENT.md`
- **Firebase package:** `packages/firebase/docs/`
- **Agent coding rules:** `apps/print-agent/AGENTS.md`
- **Print shop coding rules:** `apps/print-shop/AGENTS.md`

When you add features, update the relevant `AGENTS.md` or arc doc in the same change if behavior or scope shifts materially.
