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
5. Stores the shop refresh token and machine fingerprint for the UI, and uses that refresh token itself: it owns the PC's Firebase login (`Core/Cloud/FirebaseTokenManager`) and hands the UI ID tokens (`cloud.getIdToken`).
6. Listens to the shop's Realtime Database doorbell over plain HTTPS SSE (`Core/Cloud/DoorbellClient`); no Firebase SDK.
7. Starts and stops with the desktop app (`--parent-pid`), with a stable per-user pipe and a single-instance lock. On the way out it closes the stream and marks the PC offline.

Windows-only. Needs the .NET 8 SDK.

---

## Layout

```text
Contracts   models + RPC names. No pipes, no Win32, no Host.
Ipc         framing, dispatcher, NamedPipeServerStream.
Core        AgentRuntime + handlers + SQLite job journal + background worker.
Windows     EnumPrinters, Print Schema/GDI catalog, Credential Manager, machine fingerprint.
Host        Program, CLI, log file, parent watcher.
Tests       framing + hello/auth/printers/jobs + cloud (SSE parser, token manager, doorbell, sync service, report outbox, SQLite report columns, cloud.* handlers; fake clock and HttpMessageHandler). No Host.
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
- The agent calls the API as the signed-in shop user (`Authorization: Bearer <ID token>`, one refresh and retry on a 401); there is no device key. Cloud work (traffic scaling v2, implementation plan 10.4–10.5):
  - **Sync** (`Core/Cloud/AgentSyncService`): on the doorbell's `workAt`, `sync.request` or a new session, `POST .../agents/{agentId}/sync` accepts paid orders and returns this PC's claimed jobs with download links. Signals coalesce. No timer while idle; only a failed sync is retried (2 s doubling to 60 s).
  - **One print per lease:** a claimed job already in SQLite with the same `cloud_job_id` and `lease_id`, in any state, is skipped. A shop retry has a new lease and prints again.
  - **Failed staging:** a download or hash failure is recorded as a FAILED job (`AGENT_STAGING_FAILED`) with its report pending, so the shop can retry or reassign it.
  - **Reports** (`Core/Cloud/ReportOutbox`): `Complete`, `Fail` and `Cancel` mark a cloud job's `report_state` `pending` in the same SQLite update. The outbox sends up to 20 to `POST .../jobs/report`: `ok` → `acked`; `lease_mismatch`, `invalid_state`, `not_found` → `rejected`; `retry` or a failed request → back off 1 s doubling to 5 min, honouring `Retry-After`. Only the active shop and agent's reports go out.
  - **Error text:** the server limits `errorMessage` to 500 characters.
- `printers.testPage` writes a one-page PDF and prints through the same GDI executor as orders. `host.exportLog` copies `agent.log` to a caller-supplied path without document bytes, tokens, or signed URLs.
- Pause/resume of an in-flight Windows GDI job is unsupported; the queue UI retries, reassigns, or cancels instead.
- PRD leftover tracker: [`CtrlP_Print_Shop_Desktop_MVP_Progress.md`](../../docs/developer-requirement/desktop-app/CtrlP_Print_Shop_Desktop_MVP_Progress.md).

Logs: `%LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log` (mirrored to stderr). Each RPC logs method, id, and elapsedMs. Capability reads log per-printer timeouts; winspool is the fallback if `LocalPrintServer` fails.
