# Print shop UI — handbook

**Source of truth for `apps/print-shop`.**  
Product architecture: [`docs/arc/PRINT_SHOP_DESKTOP.md`](../../docs/arc/PRINT_SHOP_DESKTOP.md).

This is the **Tauri 2 + React frontend**. Native Windows work belongs in `apps/print-agent`.

UI design: repo root `AGENTS.md` and `docs/design-system/` (`DESIGN copy.md`, `tokens copy.json`). Use `@ctrlp/ui`. No new colors, radii, or shadows.

---

## What this project is

- React shell: login, dashboard summary, Orders/order details, Printers (capabilities + shop default / enable / offer color-A3), durable local queue view, settings.
- Thin Rust: spawn the C# sidecar, JSON-RPC over a named pipe, Tauri commands.
- HTTP to `apps/server` for auth, device, printer inventory, orders, documents, and server-mediated SSE (no Firebase SDK).
- Not a browser app. `pnpm shop:dev` (Vite) cannot reach the agent.

PRD leftover list: [`docs/developer-requirement/desktop-app/CtrlP_Print_Shop_Desktop_MVP_Progress.md`](../../docs/developer-requirement/desktop-app/CtrlP_Print_Shop_Desktop_MVP_Progress.md).

---

## Layout

```text
src/                 React (`lib/agent.ts` is the only IPC client)
src-tauri/src/
  commands.rs        invoke names → RPC methods
  agent/             boot sidecar, framing, bridge
scripts/
  publish-sidecar.mjs
  run-with-toolchain.mjs
```

Keep Tauri commands thin. Do not put printer logic in Rust or React.

---

## Commands

From repo root:

```powershell
pnpm desktop:setup
pnpm desktop:dev      # sidecar + tauri dev (injects cargo/dotnet/MSVC onto PATH)
pnpm desktop:build    # NSIS installer
pnpm shop:test
pnpm shop:typecheck
```

`beforeDevCommand` / `beforeBuildCommand` always publish the C# sidecar first.

---

## How to change this code

| Change | Where |
| --- | --- |
| Screen copy/layout | `src/App.tsx`, `src/screens/LoginScreen.tsx`, `src/screens/PrintersScreen.tsx` |
| Login / shop identity | `src/screens/LoginScreen.tsx` + `src/lib/cloud.ts` (HTTP to `apps/server`, no Firebase SDK) |
| Printer shop config | `src/screens/PrintersScreen.tsx` + `src/lib/printers.ts` + `cloud.ts` GET/POST/PATCH |
| New agent operation | C# handler first, then `commands.rs`, then `src/lib/agent.ts` |
| Pipe/framing | keep in sync with `Ctrlp.PrintAgent.Ipc` |
| Sidecar file name | `tauri.conf.json` `externalBin` + `publish-sidecar.mjs` |
| PATH / cargo not found | `scripts/run-with-toolchain.mjs` |

Do **not**:

- Call `winspool` or .NET from the UI.
- Recreate shadcn components here; add them to `packages/ui`.
- Check in `src-tauri/binaries/*.exe` or `src-tauri/target/`.

Debug: UI logs are `[print-shop]` in DevTools. Rust logs are `[print-shop:…]` in the `pnpm desktop:dev` terminal. Agent logs are `%LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log`.
