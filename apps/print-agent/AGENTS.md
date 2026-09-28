# Print agent — handbook

**Source of truth for `apps/print-agent`.**  
Product architecture: [`docs/arc/PRINT_SHOP_DESKTOP.md`](../../docs/arc/PRINT_SHOP_DESKTOP.md).

This is the **C# Windows sidecar**. It is the backend for `apps/print-shop`. Do not put Win32 / spooler calls in the Tauri React app.

---

## What this project is

A long-running .NET 8 process that:

1. Listens on a Windows named pipe (`JSON-RPC 2.0`, length-prefixed frames).
2. Authenticates the UI with `agent.hello` + token.
3. Discovers printers through `winspool.drv`.
4. Holds a local in-memory job list (no physical print yet).
5. Exits when `--parent-pid` exits (Tauri sets this).

Windows-only. Needs the .NET 8 SDK.

---

## Layout

```text
Contracts   models + RPC names. No pipes, no Win32, no Host.
Ipc         framing, dispatcher, NamedPipeServerStream.
Core        AgentRuntime + handlers + InMemoryJobStore.
Windows     EnumPrinters / GetDefaultPrinter only.
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
| Job lifecycle (still in-memory) | `Core/Jobs` |
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

- `jobs.enqueue` records a queued job; it does not spool.
- Queue is not durable.
- No cloud/auth in this process yet.

Logs: `%LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log` (mirrored to stderr). Each RPC logs method, id, and elapsedMs. Winspool logs EnumPrinters probe size, returned count, and timeouts.
