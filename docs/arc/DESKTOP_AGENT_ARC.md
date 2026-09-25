# Ctrlp Desktop Agent Architecture (C# / Windows)

> **Not the current prototype.** Code in `apps/desktop-proto` is a capabilities-only WPF viewer.  
> Agents must follow **`docs/desktop-proto/AGENTS.md`**. Do not implement this document until a human expands the prototype scope.

The rest of this file is a **future product sketch** (shop UI + print agent + cloud). Rust + Tauri is already retired.

---


## 1. Product shape

Shop computers need a native Windows application that:

1. Discovers printers installed on the machine.
2. Reads every setting the printer/driver actually supports.
3. Lets shop owners configure those printers.
4. Submits print jobs through the Windows print subsystem.
5. Talks to Ctrlp cloud over the internet so remote orders can become local prints.

That is **one application** with two logical roles:

```text
Ctrlp Shop Desktop.exe
│
├── Shop UI          shop owners configure printers, print, connect to cloud
└── Print Agent      job orchestration, Windows printing, cloud I/O
```

Day 1 they run in the same process. Later the agent can move to a Windows background service without rewriting printing or cloud code.

Do **not** split this into:

```text
Tauri UI.exe  +  Rust agent.exe
```

and do **not** talk to printer hardware with vendor protocols. The application tells Windows what to print. The installed driver talks to the device.

---

## 2. System diagram

```text
                         CTRLP CLOUD
                    HTTPS / REST (WebSocket later)
                              │
                              ▼
                 ┌────────────────────────────────┐
                 │     CTRLP SHOP DESKTOP         │
                 │                                │
                 │  ┌──────────────────────────┐  │
                 │  │ WPF Shop UI              │  │
                 │  │                          │  │
                 │  │ Print                    │  │
                 │  │ Printers / capabilities  │  │
                 │  │ Cloud settings           │  │
                 │  └────────────┬─────────────┘  │
                 │               │                │
                 │  ┌────────────▼─────────────┐  │
                 │  │ Agent Core               │  │
                 │  │ job submit + validation  │  │
                 │  └────────────┬─────────────┘  │
                 │               │                │
                 │     ┌─────────┴─────────┐      │
                 │     ▼                   ▼      │
                 │  Printing            Cloud     │
                 │  Windows APIs        HttpClient│
                 └─────┬──────────────────────────┘
                       │
                       ▼
               Windows Print Spooler
                       │
                       ▼
                 Printer Driver
                       │
                       ▼
                Physical Printer
```

**WPF = interface.**  
**Agent Core = orchestration.**  
**Printing module = Windows adapter.**  
**Cloud module = internet adapter.**  
**Windows spooler/driver = machinery that talks to the printer.**

---

## 3. Why C# on Windows

The prototype already proved the hard path:

```text
PDF → WPF/C# app → Windows Print API → spooler → driver → physical printer
```

C# is the right native layer because:

- `System.Printing` reads Print Schema capabilities and print tickets.
- `System.Drawing.Printing` submits GDI jobs the spooler already understands.
- WinRT `Windows.Data.Pdf` renders PDFs without Adobe.
- `HttpClient` is the production internet stack.
- The same process can host UI today and a Windows Service later.

Rust/Tauri would re-implement a stack we already have working.

---

## 4. Solution layout

```text
apps/desktop-proto/
│
├── Ctrlp.Desktop.sln
│
└── src/
    ├── Ctrlp.Agent.Abstractions   contracts, models, cloud DTOs
    ├── Ctrlp.Agent.Core           print agent facade
    ├── Ctrlp.Agent.Printing       Windows discovery, capabilities, print, status
    ├── Ctrlp.Agent.Cloud          HTTPS client + local cloud settings
    └── Ctrlp.Desktop              WPF shop UI
```

| Project | Responsibility | Dependencies |
| --- | --- | --- |
| **Abstractions** | Models and interfaces only. No WPF, no Windows print APIs, no HTTP. | none |
| **Core** | `PrintAgent` — the UI and future service both call this. | Abstractions |
| **Printing** | Printer discovery, Print Schema catalog, PDF render, GDI submit, spooler watch. | Abstractions |
| **Cloud** | Health check, printer publish, job pull, status report over HTTPS. | Abstractions |
| **Desktop** | Shop UI. Wires the modules together at startup. | Core, Printing, Cloud |

Rule: **business decisions stay out of XAML.** The window asks the agent for printers, capabilities, and job submit. The agent decides how Windows does it.

---

## 5. Layers

### Layer 1 — Shop UI (WPF)

Pages:

- **Print** — pick a PDF, pick a printer, render that printer’s settings, submit.
- **Printers** — inspect every advertised capability, grouped for shop configuration.
- **Cloud** — base URL, agent id, access token, connection test, publish printers.

The UI does not hard-code paper / color / duplex. It binds to a capability catalog from the driver.

### Layer 2 — Agent core

```text
IPrintAgent
  GetPrinters()
  GetCapabilities(printer)
  LoadDocument(path)
  Submit(document, printer, ticket, progress)
```

This is the stable façade. Cloud jobs later call the same `Submit` that the Print page uses.

### Layer 3 — Printing adapter (Windows)

```text
IPrinterDiscovery
IPrinterCapabilitiesReader
IDocumentReader
IPrintJobRunner
```

Implemented with:

```text
LocalPrintServer / PrintQueue     discovery + Print Schema XML
PrinterSettings                   GDI fallback (paper, trays, dpi)
Windows.Data.Pdf                  PDF page render
PrintDocument                     silent GDI submit
PrintQueue jobs                   queued / printing / completed
```

### Layer 4 — Cloud adapter (internet)

```text
ICloudGateway
  CheckHealth
  PublishPrinters
  PullJobs
  ReportJobStatus

ICloudSettingsStore   %AppData%/Ctrlp/agent-cloud.json
```

HTTP only for now. The interface is small enough to add a WebSocket job stream later without touching printing.

### Layer 5 — Physical printer

```text
Windows Driver → Spooler → Device
```

The agent never speaks USB, IPP, or a vendor SDK in this architecture.

---

## 6. Printer capabilities

This is a first-class product surface, not a handful of checkboxes.

### How Windows describes a printer

```text
Printer queue
    ↓
Print Schema (PrintCapabilities XML)
    ↓
Features (pick one option) + Parameters (copies, etc.)
```

`WindowsPrinterCapabilitiesReader` loads `PrintQueue.GetPrintCapabilitiesAsXml()`, then merges:

1. **Print Schema features** — paper, duplex, color, bins, quality, staple, N-up, vendor options, …
2. **Print Schema parameters** — copies and other numeric/text settings.
3. **Current PrintTicket** — the driver’s default/current selection.
4. **GDI fallback** — paper sizes, trays, resolutions, color, duplex if XML is thin.

The UI then renders **whatever that printer reported**. If a printer has no duplex, duplex is not offered. If it has staple or a custom tray, those appear.

### Ticket used at print time

The shop UI collects a `PrintTicketRequest` (setting name → value). The print runner:

1. Validates values against the catalog.
2. Maps well-known settings onto GDI (`copies`, paper, orientation, color, duplex, tray, dpi).
3. Merges a Print Schema ticket onto the queue so driver-specific options still apply.

Page range is a **document** setting, not a printer capability, so it stays on the Print page.

---

## 7. Print job flow

Local (today):

```text
Shop UI
  → PrintAgent.Submit
  → validate PDF + printer + ticket
  → render selected PDF pages
  → GDI PrintDocument (no Windows print dialog)
  → spooler
  → driver
  → paper
  → status: Preparing → Queued → Printing → Completed | Failed
```

Cloud (same runner, different source):

```text
Ctrlp Cloud
  → HTTPS job (document URL + printer + settings)
  → agent downloads document
  → PrintAgent.Submit
  → report status back to cloud
```

The print engine must not care whether the operator clicked **Print document** or a cloud worker handed it a job.

---

## 8. Agent job states

Keep local execution state separate from cloud order state.

Local:

```text
Preparing → Queued → Printing → Completed
                         ↘ Failed
                         ↘ Cancelled
```

Future cloud-facing granularity can add `Downloading` / `Validating` around the same runner. Do not force Postgres order status and spooler status to be the same enum.

---

## 9. Cloud / internet

The agent is an HTTPS client, not a public server.

Configured in the Cloud page and stored locally:

- Cloud URL (`https://…`)
- Agent id
- Access token (`Authorization: Bearer …`)

Endpoints the client is written against:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `health` | Reachability |
| PUT | `v1/agent/printers` | Publish discovered printers + capabilities |
| GET | `v1/agent/jobs` | Pull waiting jobs |
| POST | `v1/agent/jobs/{id}/status` | Report local execution state |

Until those routes exist on the server, **Test connection** still proves the PC can talk to the internet. Printing stays fully usable offline.

Later: replace pull with a WebSocket/SSE stream **behind `ICloudGateway`**. Do not put sockets in the WPF code-behind.

---

## 10. UI vs agent lifetime

Do not couple printing to the window forever.

Today:

```text
One process: UI + agent modules
```

Designed so we can evolve to:

```text
Ctrlp.Desktop.exe          shop UI
        │  local API / named pipe
        ▼
Ctrlp.Agent.Service        Windows service
        │
        ▼
Windows spooler
```

That is why Printing and Cloud are class libraries, not window code.

Until shops need background printing with the UI closed, keep one installer and one process.

---

## 11. What must not happen

- Do not rebuild this in Tauri/Rust.
- Do not put spooler calls in XAML code-behind.
- Do not hard-code A4 / color / duplex as the only settings.
- Do not bypass the Windows print dialog by talking to the printer cable directly.
- Do not embed PDFs in cloud control messages; send a URL, download, print, delete.
- Do not make the React/Next.js apps responsible for physical printing.

---

## 12. Mapping from the old Tauri document

| Old (retired) | Now |
| --- | --- |
| React + Tauri UI | WPF (`Ctrlp.Desktop`) |
| Tauri commands | ViewModels calling `IPrintAgent` |
| Rust core | `Ctrlp.Agent.Core` |
| Rust Windows adapter | `Ctrlp.Agent.Printing` |
| Rust cloud client | `Ctrlp.Agent.Cloud` |
| `invoke("get_printers")` | `agent.GetPrinters()` |
| Print Schema in Rust | Print Schema in C# `System.Printing` |

The *ideas* in the old document still apply: one shop PC app, Windows owns hardware, agent owns jobs, UI is presentation, cloud is the source of orders. Only the implementation language and shell changed.

---

## 13. Implementation status

Already in `apps/desktop-proto`:

- Modular C# solution as above
- Dynamic printer-setting UI from Print Schema + GDI
- Silent PDF print through the spooler
- Cloud settings + HTTPS health / publish / jobs client

Next:

1. Pair agent identity with a real shop in the backend.
2. Download cloud documents into a temp folder, print, delete.
3. Persist a local retry queue when the printer is offline.
4. Optional Windows Service host using the same Core + Printing + Cloud projects.
