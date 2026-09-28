# CtrlP Print Shop Desktop (Tauri UI + C# Agent)

> **Status:** Scaffold complete (IPC, printer discovery, sidecar bundling). Physical print execution is not implemented yet.  
> **Platform:** Windows 10/11 x64 only.  
> **Source of truth for this stack:** this file, plus `apps/print-shop/AGENTS.md` and `apps/print-agent/AGENTS.md`.

This is the current shop desktop product path. It is **not** the WPF prototype in `apps/desktop-proto`, and it is **not** the older all-Rust agent described in `SHOP_DESKTOP_AGENT_V1.md`.

---

## 1. Goal

Shop operators get **one installer EXE**. After install:

1. The Tauri app (React UI) is the frontend.
2. A compiled C# agent runs as a sidecar, in a loop, talking to Windows APIs.
3. The UI sends jobs/commands; the agent processes them and returns results.

```text
Operator
   │
   ▼
Print Shop UI  (React in Tauri 2 webview)
   │  invoke(...)
   ▼
Thin Rust shell  (spawn sidecar, named-pipe JSON-RPC client)
   │  \\.\pipe\ctrlp-print-agent-{id}
   ▼
C# print agent  (sidecar EXE, infinite listen loop)
   │  winspool.drv
   ▼
Windows Print Spooler → printer driver → hardware
```

---

## 2. What exists today

| Layer | Location | Role | Implemented |
| --- | --- | --- | --- |
| Shop UI | `apps/print-shop` | Dashboard, Printers, Print queue, Settings | Shell + live agent/printer/queue views |
| Tauri commands | `apps/print-shop/src-tauri/src/commands.rs` | Thin RPC proxy | Ping, status, printers, jobs |
| Rust IPC | `apps/print-shop/src-tauri/src/agent/` | Spawn sidecar, framed JSON-RPC | Hello handshake, request/response, events |
| C# host | `apps/print-agent/.../Host` | Process loop, CLI, parent watch, log file | Yes |
| C# IPC | `apps/print-agent/.../Ipc` | Named pipe server, JSON-RPC 2.0 | Yes |
| C# core | `apps/print-agent/.../Core` | Handlers, in-memory job store | Yes |
| Windows adapter | `apps/print-agent/.../Windows` | `EnumPrinters` / default printer | Discovery and status only |
| Sidecar bundle | `externalBin` + publish script | Agent EXE next to Tauri binary | Yes |
| NSIS installer | `tauri.conf.json` `bundle.targets: ["nsis"]` | Single setup EXE for the shop PC | Configured; needs `pnpm desktop:build` |

**Not built yet (intentional scaffold gap):**

- Submitting a real PDF/image to the Windows spooler
- Durable job queue (jobs live in memory; lost on restart)
- Cloud / Firestore / shop auth in this app
- The six full MVP screens (orders, pricing, payments, etc.)
- Windows Service host (agent currently dies with the UI via `--parent-pid`)

---

## 3. Repositories layout

```text
apps/print-agent/                         C# sidecar
  Ctrlp.PrintAgent.sln
  src/
    Ctrlp.PrintAgent.Contracts/          DTOs, RPC method names, errors
    Ctrlp.PrintAgent.Ipc/                framing + JSON-RPC + named pipe
    Ctrlp.PrintAgent.Core/               runtime, handlers, in-memory jobs
    Ctrlp.PrintAgent.Windows/            winspool.drv P/Invoke
    Ctrlp.PrintAgent.Host/               console/WinExe entrypoint
  tests/Ctrlp.PrintAgent.Tests/

apps/print-shop/                          Tauri 2 frontend
  src/                                   React UI (@ctrlp/ui, design system)
  src-tauri/                             Rust shell
    binaries/                            sidecar EXE (gitignored)
    capabilities/default.json            shell spawn permission for sidecar
  scripts/
    publish-sidecar.mjs                  dotnet publish → Tauri sidecar name
    run-with-toolchain.mjs               puts cargo/dotnet/MSVC on PATH

scripts/desktop-setup.ps1                 install .NET 8, Rust, VS Build Tools
scripts/generate-print-shop-icons.ps1     app icons
```

Dependency rule for C#:

```text
Host → Core → Ipc → Contracts
Host → Windows → Contracts
```

Windows APIs stay in `Ctrlp.PrintAgent.Windows`. React never calls Win32.

---

## 4. Communication protocol

**Transport:** Windows named pipe, current-user-only.  
**Envelope:** JSON-RPC 2.0.  
**Framing:** 4-byte little-endian length prefix, then UTF-8 JSON. Max frame 16 MiB.  
**Protocol version:** `1.0.0` (`ProtocolInfo.Version` / `src/lib/protocol.ts`).

### Handshake

1. Tauri generates a random pipe name `ctrlp-print-agent-{uuid}` and a token.
2. Spawns sidecar: `--pipe … --token … --parent-pid {tauri pid}`.
3. Connects to `\\.\pipe\{pipe}`.
4. First RPC must be `agent.hello` with `{ "token", "client": "print-shop" }`.
5. Later methods are rejected until hello succeeds (`-32001 Unauthorized`).

### Methods

| Method | Params | Result |
| --- | --- | --- |
| `agent.hello` | `{ token, client? }` | `{ protocolVersion, agentVersion, pipeName }` |
| `agent.ping` | `{}` | `{ ok, ts }` |
| `agent.status` | `{}` | `{ protocolVersion, agentVersion, state, pipeName, uptimeMs, printerCount, queuedJobs }` |
| `agent.shutdown` | `{}` | `{ ok }` |
| `printers.list` | `{}` | `{ printers: PrinterDto[] }` |
| `printers.get` | `{ id }` | `PrinterDto` |
| `printers.refresh` | `{}` | `{ printers }` |
| `jobs.enqueue` | `{ printerId?, documentPath?, documentName?, copies? }` | `JobDto` |
| `jobs.list` | `{}` | `{ jobs }` |
| `jobs.get` | `{ id }` | `JobDto` |
| `jobs.cancel` | `{ id }` | `JobDto` |

`PrinterDto` fields: `id`, `name`, `isDefault`, `status`, `jobCount`, `portName`, `driverName`, `isShared`.  
Printer `id` is the Windows printer name for now.

`JobDto` fields: `id`, `state`, `printerId`, `documentName`, `copies`, `createdAt`, `error`.  
Enqueue validates `printerId` if present; it does **not** print.

### UI → Rust commands

React calls `@tauri-apps/api/core` `invoke`:

| Invoke | RPC |
| --- | --- |
| `agent_ping` | `agent.ping` |
| `get_agent_status` | `agent.status` (or local snapshot if disconnected) |
| `list_printers` / `get_printer` / `refresh_printers` | printers.* |
| `enqueue_job` / `list_jobs` / `get_job` / `cancel_job` | jobs.* |
| `shutdown_agent` | `agent.shutdown` |

Notifications from the agent (JSON-RPC without `id`) are forwarded as Tauri event `agent:event`.

### Agent CLI

```text
ctrlp-print-agent.exe
  --pipe <name>          default: ctrlp-print-agent
  --token <secret>       required in production; `dev-token` with --dev
  --parent-pid <pid>     exit when this process exits
  --dev                  allow anonymous after empty token / skip strict hello
```

Logs: `%LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log` and stderr.

---

## 5. Sidecar and the single installer

Tauri `bundle.externalBin` is `binaries/ctrlp-print-agent`.

On Windows the file **must** be named:

```text
apps/print-shop/src-tauri/binaries/ctrlp-print-agent-x86_64-pc-windows-msvc.exe
```

`scripts/publish-sidecar.mjs`:

1. `dotnet publish` Host as self-contained, single-file, `win-x64`
2. Copy `ctrlp-print-agent.exe` to the triple-suffixed sidecar path

`pnpm desktop:dev` and `pnpm desktop:build` run that script first (`beforeDevCommand` / `beforeBuildCommand`).

`pnpm desktop:build` produces an NSIS setup EXE (one file the shop installs). Installed layout is the Tauri app + bundled sidecar, not a merged single process. The agent is spawned by Tauri at runtime.

Sidecar binaries are gitignored. Always publish before `tauri dev` / `tauri build`.

---

## 6. Commands (repo root)

All desktop work is meant to run from the **repo root** with `pnpm`.

| Script | Purpose |
| --- | --- |
| `pnpm desktop:setup` | Install .NET 8 SDK, Rustup, VS 2022 Build Tools (C++) |
| `pnpm desktop:dev` | Publish sidecar + `tauri dev` |
| `pnpm desktop:build` | Publish sidecar + `tauri build` (NSIS) |
| `pnpm desktop:test` | C# tests + shop Vitest |
| `pnpm desktop:sidecar` | Publish agent sidecar only |
| `pnpm desktop:typecheck` | Shop `tsc --noEmit` |
| `pnpm agent:restore` / `agent:build` / `agent:test` / `agent:dev` | C# only |
| `pnpm shop:dev` | Vite UI only (no agent; browser cannot use named pipes) |
| `pnpm shop:build` / `shop:test` / `shop:lint` / `shop:typecheck` | Shop frontend |

`apps/print-shop/scripts/run-with-toolchain.mjs` prepends:

- `%USERPROFILE%\.cargo\bin`
- `C:\Program Files\dotnet`
- Node / pnpm locations
- MSVC `Hostx64\x64` (so `link.exe` is found)

That is why `desktop:dev` can work even when a stale terminal does not have `cargo` on `PATH`. `agent:dev` does **not** use that wrapper; it needs `pnpm` and `dotnet` on `PATH`.

---

## 7. Toolchain

Required on the machine:

| Tool | Why |
| --- | --- |
| Windows 10/11 x64 | Named pipes, winspool, Tauri Windows target |
| Node.js + pnpm 11 | Monorepo scripts |
| .NET 8 SDK | C# agent |
| Rust (stable, `x86_64-pc-windows-msvc`) | Tauri shell |
| VS 2022 Build Tools + C++ workload | `link.exe` |
| WebView2 | Tauri webview (usually already on Windows 11) |

If `pnpm` is missing in PowerShell or a VS Code task:

```powershell
$env:Path = "$env:LOCALAPPDATA\pnpm;$env:LOCALAPPDATA\pnpm\bin;$env:USERPROFILE\.cargo\bin;C:\Program Files\dotnet;C:\Program Files\nodejs;" + $env:Path
```

Then `pnpm desktop:dev`. Opening a **new** terminal after `desktop:setup` also picks up user PATH entries rustup added.

---

## 8. How to run

First time:

```powershell
pnpm install
pnpm desktop:setup
# new terminal
pnpm desktop:dev
```

Agent alone (debug pipe `ctrlp-print-agent`, token `dev-token`):

```powershell
pnpm agent:dev
```

Tests:

```powershell
pnpm desktop:test
```

Installer:

```powershell
pnpm desktop:build
```

Output is under `apps/print-shop/src-tauri/target/release/bundle/nsis/`.

---

## 9. UI notes

The shop UI uses `@ctrlp/ui` and `docs/design-system/` (`DESIGN copy.md`, tokens). No new color/radius tokens. Flat, 12px radius, green primary.

Opening `pnpm shop:dev` in a browser shows the shell but cannot talk to the agent. Use `pnpm desktop:dev`.

---

## 10. Related docs (do not confuse)

| Doc | Role |
| --- | --- |
| **This file** | Current Tauri + C# sidecar stack |
| `apps/print-shop/AGENTS.md` | Rules when editing the UI/shell |
| `apps/print-agent/AGENTS.md` | Rules when editing the C# agent |
| `docs/desktop-proto/AGENTS.md` | WPF capabilities prototype only |
| `docs/arc/DESKTOP_AGENT_ARC.md` | Older WPF product sketch |
| `docs/arc/SHOP_DESKTOP_AGENT_V1.md` | Retired all-Rust-in-Tauri plan |
| `docs/developer-requirement/desktop-app/` | Product MVP (screens, FRD) — future work on this stack |
