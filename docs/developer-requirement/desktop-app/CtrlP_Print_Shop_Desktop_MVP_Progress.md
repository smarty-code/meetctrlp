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
- Settings is editable on desktop: shop profile and structured address, pricing (paise stored, rupees UI), 7-day hours, Color/A3 capabilities constrained to enabled printer offers, automation, diagnostics, and agent log export.

**FRs covered:** FR-01, FR-02, FR-03, FR-31, FR-32, FR-33, FR-44, FR-45.

### Printers (PRD Screen 5)

- Local queue discovery (`EnumPrinters` local + `System.Printing` / GDI capabilities, per-printer timeout).
- Cheap `printers.list` for live status/job count; `printers.refresh` / `printers.get` for the option catalog.
- Firestore inventory `shops/{shopId}/printers/{printerId}`: hardware flags, `options`, `agentId`, `enabled`, `offered.{bw,color,a4,a3}`, shop `isDefault`.
- `GET` printers after restart; sync does not clobber shop config or `defaultPrintSettings` after first create.
- `PATCH` default / enabled / offer color and A3 (offer ⊆ hardware). Disabled printers cannot be default. Shop `capabilities.colorPrinting` / `a3Printing` derived from enabled offers.
- Printers screen + drawer: badges, live status pills, Rediscover → sync → merge, shop default recipe display, and a real one-page Windows test print (`printers.testPage` → same GDI executor, including Print to PDF under `%LOCALAPPDATA%\Ctrlp\PrintAgent\output`).
- Routing remains shop default then least-busy compatible enabled printer; the UI shows which printer that is.

**FRs covered:** FR-04, FR-05, FR-06, FR-34, FR-42.  
**FR-41:** hardware and offered flags are stored; server routing and agent execution reject incompatible jobs.  
**FR-32:** shop color/A3 bits follow enabled printer offers and can be saved from Settings.

### Dashboard (PRD Screen 1)

- Operational KPIs from the live order stream: new, active, printing, ready, completed today, paid-online today, cash pending, cash in drawer today.
- Attention for failed jobs and offline/error/paused printers.
- Recent orders and in-app notifications for new orders, print failures, and printer offline.
- `shops.stats` increments on cash collection and order completion.

**FRs covered:** FR-43.

### Orders and order details (PRD Screens 2–3)

- Authenticated server-mediated SSE supplies snapshots plus order and print-job deltas; the client reconnects with bounded backoff and always starts from an authoritative REST snapshot.
- Orders has New, Active, Ready, and Completed filters plus order-number/file-name search, date, and payment method/status filters. Cards show page count and created time.
- Order details displays payment, documents, page/copy/color/paper requirements, print-readiness against shop-offered printers, accept/reject, print-job state, reassign on FAILED, ready, and completion actions.
- Short-lived document URLs are hash-checked before preview and audit `DOWNLOADED` / `PREVIEWED`. After a successful spool the assigned agent acknowledges shred; later downloads are rejected (`DOCUMENT_SHREDDED`).
- Cash is collected only once the order is `READY`; tender/change and the collecting operator are recorded before pickup completion. Customer-visible order status remains the Firestore order document.

**FRs covered:** FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, FR-14, FR-15, FR-16, FR-17, FR-26, FR-28, FR-29, FR-30, FR-35/FR-36, FR-38 (mutations send `idempotencyKey` where the server stores one), FR-39 (lease conflicts surface as "another device claimed this job"), FR-40, FR-46.

### Durable local queue (PRD Screen 4)

- SQLite WAL journal at `%LOCALAPPDATA%\Ctrlp\PrintAgent\queue.db`, idempotent enqueue, bounded work queue, atomic claim, retry/cancel, cloud job correlation, restart recovery, and queue indexes.
- Unified queue UI joins local `cloudJobId` to cloud jobs, with a details drawer, retry, reassign, and cancel (not while printing). Pause/resume is omitted because Windows cannot safely pause an in-flight GDI job.
- The background worker is independent of RPC request handling. JSON-RPC job notifications update the Tauri queue UI live.
- The per-user agent remains alive after the desktop window closes; a second launch reconnects to its stable pipe rather than running competing workers.
- The cloud synchronizer uses a device-scoped credential, leases assigned jobs, stages PDF/PNG/JPEG under the agent data root, verifies hashes, reports lifecycle state, and acknowledges shred after spool.
- PDF pages render through PDFium (`Docnet.Core`); PNG/JPEG render with GDI and all formats submit with `PrintDocument`, never raw `WritePrinter` bytes. The spooler ID is reported when observable.

**FRs covered:** FR-18–FR-25, FR-26, FR-37, FR-38, FR-39, and secure cloud-to-agent handoff.
**Limit:** a driver accepting `PrintDocument` is not a proof of physical paper output; inspect the Windows queue/driver for hardware-level confirmation. Per-page driver progress (FR-21) stays lifecycle-only when the spooler does not expose page counts.

---

## Left to build

Delete each bullet when it ships.

### Explicitly out of this MVP (do not put in Left to build)

Duplex as a customer option, pages-per-sheet, orientation/scaling/collation/binding/stapling, home delivery, vendor USB/IPP SDKs, Firebase client SDK in the desktop app, Windows Service host (the current detached agent is per-user).

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
| FR-10 | Secure document | **Done** (leased staging/hash/local wipe + remote shred acknowledgement) |
| FR-11 | Preview | **Done** (temporary browser preview) |
| FR-12 | Show print config | **Done** |
| FR-13 | Validate for print | **Done** (server MIME/signature + agent hash/staging validation) |
| FR-14 | Payment status | **Done** |
| FR-15 | Accept | **Done** |
| FR-16 | Reject | **Done** |
| FR-17 | Create print jobs | **Done** (server dispatch + agent handoff) |
| FR-18 | Local queue (real jobs) | **Done** (leased staging and durable SQLite execution) |
| FR-19 | Route printer | **Done** (compatible enabled online route) |
| FR-20 | Spool to printer | **Done** (PDF/JPEG/PNG through GDI driver path) |
| FR-21 | Print progress | **Partial** (lifecycle events; no per-page driver progress) |
| FR-22 | Print success | **Done** (spool submission; hardware confirmation remains driver-dependent) |
| FR-23 | Print fail | **Done** (agent/server failure state) |
| FR-24 | Retry | **Done** (local retry + server retry/reassign in queue and order details) |
| FR-25 | Printer unavailable | **Done** (routing and executor reject unavailable queues) |
| FR-26 | Reassign printer | **Done** (queue drawer and failed-job reassign) |
| FR-27 | Cash received | **Done** |
| FR-28 | Ready for pickup | **Done** |
| FR-29 | Complete order | **Done** |
| FR-30 | History | **Done** |
| FR-31 | Pricing config | **Done** |
| FR-32 | Shop capabilities | **Done** (derived from printer offers; Settings editor) |
| FR-33 | Device diagnostics | **Done** (cloud, SSE, agent, printers, heartbeat, versions, queued jobs) |
| FR-34 | Printer diagnostics | **Done** (live status + hardware drawer) |
| FR-35 | Connection lost | **Done** (order stream state and recovery) |
| FR-36 | Reconnect + resync | **Done** (orders) |
| FR-37 | Recover print jobs | **Done** (durable journal; crash marks in-flight print failed for retry) |
| FR-38 | Idempotent actions | **Done** (desktop sends keys where the server stores them) |
| FR-39 | Multi-device locks | **Done** (one agent lease; conflicts surfaced, no second execution host) |
| FR-40 | Unauthorized document | **Done** (shredded documents cannot be downloaded) |
| FR-41 | Block incompatible print | **Done** (server routing and agent execution gate) |
| FR-42 | Test print | **Done** |
| FR-43 | Operator notifications | **Done** (in-app list) |
| FR-44 | Export logs | **Done** |
| FR-45 | Show versions | **Done** |
| FR-46 | Sync order state to customer | **Done** (Firestore order status/lifecycle fields) |

---

## Screen checklist

| PRD screen | Now | Left |
| --- | --- | --- |
| 1 Dashboard | KPIs, attention, recent orders, notifications | — |
| 2 Orders | Streamed filters, search, date/payment filters, accept/reject, history | — |
| 3 Order details | Preview/hash, readiness, dispatch, reassign, cash, pickup, shred | — |
| 4 Print queue | Unified local/cloud list, drawer, retry/reassign/cancel | Pause/resume unsupported |
| 5 Printers | Discovery, caps, default, enable, offer color/A3, test page, preset display | Duplex customer offer deferred |
| 6 Settings | Profile, pricing, hours, capabilities, diagnostics, log export | — |

---

## Suggested next slices (not a commitment)

The PRD Screen 1–6 should-haves for this stack are shipped. Remaining work is out of MVP unless the PRD changes: duplex as a customer option, finishing options, home delivery, vendor SDKs, and a Windows Service host.

## Verification recorded for the current built slices

- Schemas and server TypeScript checks pass.
- Print-shop TypeScript checks and Vitest tests pass, including SSE event parsing, dashboard reducers, and order-filter tests.
- Agent Release tests pass, including SQLite persistence / test-page enqueue / log export.
- Agent Host Release build and Tauri Rust `cargo check` pass.

Physical paper confirmation remains driver-dependent: spool acceptance is success for FR-20/FR-22.
