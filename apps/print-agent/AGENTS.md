# Print agent — handbook

**Source of truth for `apps/print-agent`.**  
Product architecture: [`docs/arc/PRINT_SHOP_DESKTOP.md`](../../docs/arc/PRINT_SHOP_DESKTOP.md).

This is the **C# Windows sidecar**. It is the backend for `apps/print-shop`. Do not put Win32 / spooler calls in the Tauri React app.

---

## What this project is

A long-running .NET 8 process that:

1. Listens on a Windows named pipe (`JSON-RPC 2.0`, length-prefixed frames).
2. Authenticates the UI with `agent.hello` + token.
3. Discovers local printers (winspool + Print Schema/GDI) and caches capabilities.
4. Persists local print work in `%LOCALAPPDATA%\Ctrlp\PrintAgent\queue.db` (SQLite WAL) and publishes job lifecycle notifications to the connected UI.
5. Stores the shop refresh token and machine fingerprint for the UI.
6. Runs detached from the desktop window with a stable per-user pipe and a single-instance lock.

Windows-only. Needs the .NET 8 SDK.

---

## Layout

```text
Contracts   models + RPC names. No pipes, no Win32, no Host.
Ipc         framing, dispatcher, NamedPipeServerStream.
Core        AgentRuntime + handlers + SQLite job journal + background worker.
Windows     EnumPrinters, Print Schema/GDI catalog, Credential Manager, machine fingerprint.
Host        Program, CLI, log file, parent watcher.
Tests       framing + hello/auth/printers/jobs (no Host).
```

Do not reverse those dependencies.

---

## Commands

From repo root (pnpm must be on PATH):

```powershell
pnpm agent:restore
pnpm agent:build
pnpm agent:test
pnpm agent:dev          # --pipe ctrlp-print-agent --token dev-token --dev
pnpm agent:publish      # sidecar for Tauri
```

From this folder:

```powershell
dotnet test .\Ctrlp.PrintAgent.sln -c Release
dotnet run --project .\src\Ctrlp.PrintAgent.Host\Ctrlp.PrintAgent.Host.csproj -c Debug -- --pipe ctrlp-print-agent --token dev-token --dev
```

If `pnpm` is not recognized, prepend `%LOCALAPPDATA%\pnpm` and `%LOCALAPPDATA%\pnpm\bin` to PATH, or use `dotnet` directly.

---

## How to change this code

| Change | Where |
| --- | --- |
| New RPC method / DTO | `Contracts` first, then a handler in `Core`, then Tauri `commands.rs` + `src/lib/agent.ts` |
| Framing / auth / pipe | `Ipc` |
| Job lifecycle / persistence | `Core/Jobs` |
| New Windows API | `Windows`, behind an interface in `Contracts` |
| CLI / process lifetime | `Host` |

Do **not**:

- Add WPF or a shop UI here.
- Call printers from React.
- Talk to USB/IPP/vendor SDKs; talk to Windows.
- Log document bytes or paths into analytics.
- Add a Firebase SDK.

---

## Current limits

- PDF/JPEG/PNG jobs are rendered through PDFium/GDI and submitted through `PrintDocument`; never send raw document bytes to `WritePrinter`. A successful submission is spool acceptance, not a physical-paper guarantee.
- Restart recovery marks an ambiguous in-flight print as failed for an explicit operator retry; it never blindly duplicates output.
- The agent stores a device-scoped cloud credential (not a Firebase token), claims only its assigned cloud jobs, stages/verifies them, and reports lifecycle state. Shop-user auth and printer inventory configuration stay in the Tauri UI.
- PRD leftover (orders, spool, routing): [`CtrlP_Print_Shop_Desktop_MVP_Progress.md`](../../docs/developer-requirement/desktop-app/CtrlP_Print_Shop_Desktop_MVP_Progress.md).

Logs: `%LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log` (mirrored to stderr). Each RPC logs method, id, and elapsedMs. Capability reads log per-printer timeouts; winspool is the fallback if `LocalPrintServer` fails.
