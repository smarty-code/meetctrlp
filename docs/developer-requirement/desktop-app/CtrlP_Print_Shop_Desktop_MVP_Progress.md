# CtrlP Print Shop Desktop — MVP progress

**Purpose:** Standalone tracker of what the **Tauri + C# sidecar** product has shipped versus what the PRD still requires.  
**Product PRD:** [`Print Shop Partner Desktop MVP.md`](./Print%20Shop%20Partner%20Desktop%20MVP.md) (screens 1–6, FR-01–FR-46).  
**Engineering stack:** [`docs/arc/PRINT_SHOP_DESKTOP.md`](../../arc/PRINT_SHOP_DESKTOP.md).  
**Not this product:** `apps/desktop-proto` (WPF), `docs/arc/SHOP_DESKTOP_AGENT_V1.md` (retired Rust agent).

When a leftover item ships, **move it into Built** and **delete it from Left to build**. When the leftover section is empty, the PRD loop for this stack is done.

---

## How to maintain this file

1. Source of requirements is the PRD (screens + FR table), not older WPF sketches.
2. Partial work stays in Built with a one-line limit, and the unfinished part stays in Left to build.
3. Do not invent new MVP screens here. If the PRD changes, update both documents.

Current stack: Windows Tauri 2 UI (`apps/print-shop`) + .NET 8 sidecar (`apps/print-agent`) + HTTP to `apps/server` (no Firebase SDK in the desktop app).

---

## Built

### Platform

- Tauri 2 React shell, `@ctrlp/ui` design tokens, named-pipe JSON-RPC to the C# sidecar.
- Sidecar publish, `pnpm desktop:dev` / `desktop:build` (NSIS), detached per-user agent, stable authenticated pipe, single-instance lock, and agent log at `%LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log`.
- Debug logs in UI (`[print-shop]`), Rust, and agent.

### Shop auth and this PC (PRD onboarding / device)

- Email or Indian phone + password login and register via `apps/server` (Firebase Auth REST; no OTP).
- Session restore from Windows Credential Manager (`Ctrlp.PrintShop/refreshToken`).
- Device register + 30s heartbeat; sign-out marks the agent offline and clears the refresh token.
- Settings shows operator, shop identity (read-only), hostname, device id, pipe, app version.

**FRs covered:** FR-01, FR-02, FR-03, FR-45 (app version; agent version is on `agent.status`).

### Printers (PRD Screen 5, config slice)

- Local queue discovery (`EnumPrinters` local + `System.Printing` / GDI capabilities, per-printer timeout).
- Cheap `printers.list` for live status/job count; `printers.refresh` / `printers.get` for the option catalog.
- Firestore inventory `shops/{shopId}/printers/{printerId}`: hardware flags, `options`, `agentId`, `enabled`, `offered.{bw,color,a4,a3}`, shop `isDefault`.
- `GET` printers after restart; sync does not clobber shop config or `defaultPrintSettings` after first create.
- `PATCH` default / enabled / offer color and A3 (offer ⊆ hardware). Disabled printers cannot be default. Shop `capabilities.colorPrinting` / `a3Printing` derived from enabled offers.
- Printers screen + drawer: badges, live status pills, Rediscover → sync → merge.

**FRs covered:** FR-04, FR-05, FR-06, FR-34.  
**FR-41 partial:** hardware and offered flags are stored so incompatible options can be rejected later; print-time enforcement is not built.  
**FR-32 partial:** shop color/A3 bits follow enabled printer offers; Settings has no pricing/hours/capability editor.

### Orders and order details (PRD Screens 2–3)

- Authenticated server-mediated SSE supplies snapshots plus order and print-job deltas; the client reconnects with bounded backoff and always starts from an authoritative REST snapshot.
- Orders has New, Active, Ready, and Completed filters plus basic order-number/file-name search.
- Order details displays payment, documents, page/copy/color/paper requirements, accept/reject, print-job state, ready, and completion actions.
- Short-lived document URLs are hash-checked before preview and audit `DOWNLOADED` / `PREVIEWED`. Browser preview is temporary; agent-owned staging and shred-on-handoff remain unfinished.

**FRs covered:** FR-07, FR-08, FR-09, FR-11, FR-12, FR-14, FR-15, FR-16, FR-17 (cloud job dispatch), FR-28, FR-29, FR-30, FR-35/FR-36 (order-stream recovery).  
**Limits:** local-file staging, agent handoff, page-count verification, and physical execution are not yet complete.

### Durable local queue (PRD Screen 4 foundation)

- SQLite WAL journal at `%LOCALAPPDATA%\Ctrlp\PrintAgent\queue.db`, idempotent enqueue, bounded work queue, atomic claim, retry/cancel, restart recovery, and queue indexes.
- The background worker is independent of RPC request handling. JSON-RPC job notifications update the Tauri queue UI live.
- The per-user agent remains alive after the desktop window closes; a second launch reconnects to its stable pipe rather than running competing workers.

**FRs covered:** FR-18 / FR-37 foundation, FR-24 local retry, and part of FR-21–FR-23 local lifecycle visibility.  
**Limit:** the agent safely refuses physical execution until the PDF renderer / PrintTicket path and cloud reconciliation are completed.

---

## Left to build

Delete each bullet when it ships.

### Screen 1 — Dashboard

- Operational counters: new / active / printing / ready / completed today, revenue, paid vs cash pending.
- Printer health and attention (failed jobs, offline printers) from live order + printer state.
- Recent orders list and operational notifications (FR-43).

### Screen 2 — Orders

- Customer-facing order state reconciliation (FR-46).

### Screen 3 — Order details

- Agent-owned secure document staging, local wipe, and unauthorized-document protection (FR-10, FR-13, FR-40).
- Cash collected (FR-27).
- Print readiness vs shop-offered printer capabilities (rest of FR-41).

### Screen 4 — Print queue (physical)

- Route to a compatible enabled printer (FR-19, FR-25, FR-26).
- Spool PDF to Windows (FR-20); progress, success, fail, retry, cancel (FR-21–FR-24).

### Screen 5 — Printers (remaining)

- Intelligent routing UI/preferences (beyond shop default).
- Real Windows test page (FR-42).
- Duplex as a customer offer (PRD deferred; do not add unless the PRD changes).
- Preset / default-print-settings editor (`05_print_configuration_presets.md`) — out of the last printer slice; still required before reliable job merge.

### Screen 6 — Shop & settings (remaining)

- Editable shop profile, location, hours (FR-31 adjacent).
- Pricing editor, configuration-driven rates (FR-31).
- Shop capability editor beyond printer-offer derivation (rest of FR-32).
- Export diagnostic logs without document bytes (FR-44).
- Richer device diagnostics than heartbeat + pipe (rest of FR-33).

### Cross-cutting

- Full job-action idempotency and multi-device locks (FR-38, FR-39).
- Windows Service host (the current detached agent is per-user).

### Explicitly out of this MVP (do not put in Left to build)

Home delivery, vendor USB/IPP SDKs, Firebase client SDK in the desktop app, duplex as a customer option until the PRD says so.

---

## FR checklist

| ID | PRD intent | Status |
| --- | --- | --- |
| FR-01 | Shop login | **Done** |
| FR-02 | Device registration | **Done** |
| FR-03 | Restore session | **Done** |
| FR-04 | Discover printers | **Done** |
| FR-05 | Map capabilities | **Done** (detect + store) |
| FR-06 | Shop default printer | **Done** (Firestore, not Windows default) |
| FR-07 | Realtime new order | **Done** |
| FR-08 | Show new orders | **Done** |
| FR-09 | Open order | **Done** |
| FR-10 | Secure document | Left |
| FR-11 | Preview | **Done** (temporary browser preview) |
| FR-12 | Show print config | **Done** |
| FR-13 | Validate for print | **Partial** (SHA-256; page count / agent staging left) |
| FR-14 | Payment status | **Done** |
| FR-15 | Accept | **Done** |
| FR-16 | Reject | **Done** |
| FR-17 | Create print jobs | **Done** (cloud dispatch; agent handoff left) |
| FR-18 | Local queue (real jobs) | **Partial** (durable SQLite; document handoff/execution left) |
| FR-19 | Route printer | Left (API exists on server; desktop unused) |
| FR-20 | Spool to printer | Left |
| FR-21 | Print progress | Left |
| FR-22 | Print success | Left |
| FR-23 | Print fail | Left |
| FR-24 | Retry | **Partial** (durable local retry; printer/cloud retry left) |
| FR-25 | Printer unavailable | Left |
| FR-26 | Reassign printer | Left |
| FR-27 | Cash received | Left |
| FR-28 | Ready for pickup | **Done** |
| FR-29 | Complete order | **Done** |
| FR-30 | History | **Done** |
| FR-31 | Pricing config | Left |
| FR-32 | Shop capabilities | **Partial** (derived from printer offers) |
| FR-33 | Device diagnostics | **Partial** (heartbeat, pipe, versions) |
| FR-34 | Printer diagnostics | **Done** (live status + hardware drawer) |
| FR-35 | Connection lost | **Done** (order stream state and recovery) |
| FR-36 | Reconnect + resync | **Done** (orders) |
| FR-37 | Recover print jobs | **Partial** (durable journal; physical spool recovery left) |
| FR-38 | Idempotent actions | Left (desktop); some server order APIs exist |
| FR-39 | Multi-device locks | Left |
| FR-40 | Unauthorized document | Left |
| FR-41 | Block incompatible print | **Partial** (flags stored; no execution gate) |
| FR-42 | Test print | Left |
| FR-43 | Operator notifications | Left |
| FR-44 | Export logs | Left |
| FR-45 | Show versions | **Done** |
| FR-46 | Sync order state to customer | Left |

---

## Screen checklist

| PRD screen | Now | Left |
| --- | --- | --- |
| 1 Dashboard | Shop/staff/agent summary | Operational KPIs, attention, recent orders |
| 2 Orders | Streamed filters, search, accept/reject, history | Customer synchronization |
| 3 Order details | Preview/hash check, configuration, job dispatch, pickup completion | Agent staging, physical print, cash |
| 4 Print queue | Durable journal, status, cancel/retry | Spool, progress, printer routing/reassign |
| 5 Printers | Discovery, caps, default, enable, offer color/A3 | Routing prefs, real test print, presets |
| 6 Settings | Identity + this PC | Pricing, hours, profile edit, log export |

---

## Suggested next slices (not a commitment)

Work the leftover list in PRD order of the shop loop: **orders stream → details/preview → start print/spool → pickup/cash → dashboard/pricing**. Do not expand this list beyond the PRD.
