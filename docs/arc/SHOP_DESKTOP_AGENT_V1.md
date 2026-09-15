# PrintKro Shop Desktop Agent V1
## Architecture & Implementation Plan

> **Status:** Proposed V1 architecture  
> **Primary goal:** Prove reliable local document printing from a Windows shop computer before introducing cloud transport.  
> **Core document types:** PDF, JPG/JPEG, PNG, and other normal documents that can ultimately be rendered through Windows printer drivers.  
> **V1 desktop stack:** React + TypeScript → Tauri → Rust → Windows printing subsystem → printer.

---

# 1. Executive Summary

PrintKro's Shop Desktop application is not merely a dashboard. It is the local execution layer that turns a customer's accepted print order into a physical document.

The core V1 flow is:

```text
React UI
   ↓
Tauri commands/events
   ↓
Rust Agent Core
   ↓
Print Job Queue
   ↓
Printer Manager / Router
   ↓
Print Backend
   ↓
Windows Printing Subsystem
   ↓
Printer Driver / Spooler
   ↓
Physical Printer
```

The V1 application should run as **one Tauri application/process**.

The React frontend owns presentation and user interaction.

The Rust side owns the application state, queue, job lifecycle, printer management, native Windows integration, retries, and print execution.

The architecture must **not** be designed around ESC/POS because PrintKro's actual core workload is document printing: PDF, JPG/JPEG, PNG, and similar files.

ESC/POS/RAW printing should exist as a **specific print backend**, useful for thermal/receipt-style printers and for proving the low-level Windows RAW path, but it should not become the domain model for PrintKro.

---

# 2. Architectural Decisions

## 2.1 One Tauri process for V1

V1 will package the UI and Rust agent core into one Tauri desktop application.

```text
PrintKro Shop Desktop
├── React UI
├── Tauri bridge
└── Rust agent core
```

Do not initially build:

```text
PrintKro UI.exe
PrintKro Agent.exe
```

as separate applications.

### Why

A second process introduces:

- IPC design
- process lifecycle management
- service installation
- independent update mechanisms
- additional debugging complexity
- authentication between processes
- more failure modes

None of those are necessary to prove the printing architecture.

However, the Rust core should be written so that it can later be extracted into an independent Windows background service if required.

---

# 3. Critical Architectural Correction: Document Printing vs ESC/POS

The initial V1 plan focused heavily on:

```text
Windows RAW
ESC/POS
```

This is not sufficient for PrintKro's real product.

PrintKro's primary documents are:

- PDF
- JPG/JPEG
- PNG
- images
- eventually DOC/DOCX
- eventually PPT/PPTX
- potentially other formats after rendering support is established

These should normally be treated as **document print jobs**, not arbitrary RAW byte streams.

## 3.1 Correct abstraction

Use:

```text
PrintJob
   ↓
PrintBackend
```

with multiple implementations:

```text
PrintBackend
├── WindowsDriverBackend       ← primary future/core backend
├── WindowsRawBackend          ← ESC/POS / RAW
└── MockBackend                ← tests
```

The normalized PrintKro job should describe the intended print operation:

```text
document
printer
paper size
color mode
copies
page selection
```

The backend decides how that operation is translated into an actual Windows printing operation.

---

# 4. Layer Responsibilities

## 4.1 React / TypeScript

React is responsible for:

- Dashboard UI
- Printer list
- Printer selection
- Job list
- Job details
- Queue visualization
- Configuration UI
- Error display
- User actions
- Status presentation

React must NOT contain:

- Windows API calls
- Win32 printing logic
- printer protocol logic
- queue persistence
- retry decisions
- print state authority
- document deletion logic
- printer routing algorithms

The frontend should request operations from Rust and display the resulting state.

---

# 5. Tauri Layer

Tauri is the bridge between the frontend and Rust.

It should expose a deliberately small API.

Example:

```text
React
  ↓
invoke("list_printers")
  ↓
Tauri command
  ↓
Rust
```

Tauri commands should be thin.

They should not contain the actual printer implementation.

Bad:

```text
Tauri command
 └── directly calls winspool APIs
```

Preferred:

```text
Tauri command
 └── calls AgentService
       └── PrinterManager
             └── PrintBackend / Windows adapter
```

---

# 6. Rust Agent Core

Rust is the core of the desktop agent.

Responsibilities:

- application state
- printer management
- printer discovery
- printer capability management
- job validation
- queue management
- job state transitions
- job execution
- retry handling
- routing
- local persistence
- configuration
- logging
- cloud transport integration later
- Windows native integration through adapters

The Rust core should be independent of the React UI.

This means the same core can eventually be driven by:

```text
Tauri UI
```

or:

```text
Windows background service
```

without rewriting the print engine.

---

# 7. Recommended Rust Module Structure

```text
src-tauri/
└── src/
    ├── lib.rs
    ├── main.rs
    │
    ├── commands/
    │   ├── mod.rs
    │   ├── printers.rs
    │   ├── jobs.rs
    │   ├── queue.rs
    │   ├── agent.rs
    │   └── config.rs
    │
    ├── agent/
    │   ├── mod.rs
    │   ├── service.rs
    │   ├── worker.rs
    │   └── events.rs
    │
    ├── domain/
    │   ├── mod.rs
    │   ├── printer.rs
    │   ├── job.rs
    │   ├── queue.rs
    │   ├── errors.rs
    │   └── capabilities.rs
    │
    ├── printer/
    │   ├── mod.rs
    │   ├── manager.rs
    │   ├── router.rs
    │   ├── backend.rs
    │   ├── raw.rs
    │   ├── driver.rs
    │   └── mock.rs
    │
    ├── platform/
    │   ├── mod.rs
    │   └── windows/
    │       ├── mod.rs
    │       ├── spooler.rs
    │       ├── printers.rs
    │       └── raw_print.rs
    │
    ├── queue/
    │   ├── mod.rs
    │   ├── store.rs
    │   ├── worker.rs
    │   └── transitions.rs
    │
    ├── transport/
    │   ├── mod.rs
    │   ├── local.rs
    │   └── cloud.rs          # future
    │
    ├── config/
    │   ├── mod.rs
    │   └── store.rs
    │
    └── telemetry/
        ├── mod.rs
        └── logging.rs
```

The exact filenames can change during implementation. The important architectural boundaries should remain.

---

# 8. Domain Model

The domain should not know about:

- Tauri
- React
- Windows
- `winspool.drv`
- ESC/POS

It should describe PrintKro concepts.

---

# 9. Printer Identity

Example conceptual structure:

```rust
struct Printer {
    id: PrinterId,
    name: String,
    backend: PrinterBackendType,
    status: PrinterStatus,
    capabilities: PrinterCapabilities,
}
```

Printer ID should be stable enough to associate jobs/configuration with a printer.

Do not rely exclusively on the display name if Windows provides a more appropriate identifier.

---

# 10. Printer Status

Use an explicit enum rather than free-form strings.

```rust
enum PrinterStatus {
    Online,
    Offline,
    Printing,
    Paused,
    Error,
    Unknown,
}
```

Do not assume every printer exposes every possible state.

Hardware telemetry should be treated as optional information.

---

# 11. Printer Capabilities

Example:

```rust
struct PrinterCapabilities {
    color: bool,
    paper_sizes: Vec<PaperSize>,
    max_copies: Option<u32>,
    raw_supported: bool,
}
```

Future fields can include:

```text
duplex
orientation
finishing
tray information
media types
A3
custom sizes
```

The capability model should support both:

1. capabilities discovered from Windows/driver information
2. capabilities manually configured by the shop

The two should not be conflated.

---

# 12. Print Job

The print job is the central domain object.

Conceptually:

```rust
struct PrintJob {
    id: JobId,
    order_id: Option<OrderId>,
    printer_id: PrinterId,
    document: DocumentPayload,
    options: PrintOptions,
    state: JobState,
    attempts: u32,
}
```

---

# 13. Document Payload

Do not assume every document is a byte array inside the queue.

For local V1, a job may reference a local file:

```rust
enum DocumentSource {
    LocalFile {
        path: PathBuf,
    },
    Bytes {
        data: Vec<u8>,
    },
}
```

Future cloud jobs should preferably reference a secure downloadable document rather than embedding large files directly in the control message.

For example:

```text
Cloud
 ↓
Job metadata
 ↓
Secure document URL
 ↓
Agent downloads document
 ↓
Local temporary storage
 ↓
Print
 ↓
Delete
```

---

# 14. Print Options

The core model should support the actual PrintKro requirements:

```rust
struct PrintOptions {
    color_mode: ColorMode,
    paper_size: PaperSize,
    copies: u32,
    page_selection: PageSelection,
}
```

Possible:

```rust
enum ColorMode {
    BlackAndWhite,
    Color,
}
```

```rust
enum PageSelection {
    All,
    Pages(Vec<PageNumber>),
}
```

Duplex should not be required for V1.

---

# 15. Job State Machine

Define the state machine before implementing the worker.

Recommended local state:

```text
CREATED
   ↓
VALIDATING
   ↓
READY
   ↓
QUEUED
   ↓
PRINTING
   ↓
COMPLETED
```

Failure states:

```text
VALIDATION_FAILED
PRINTER_UNAVAILABLE
PRINT_FAILED
CANCELLED
```

Potential retry transition:

```text
PRINT_FAILED
   ↓
RETRY_PENDING
   ↓
QUEUED
```

The cloud-facing order state can remain a separate concept.

Do not force the backend order state and local printer state to be identical.

---

# 16. Why Local and Cloud State Should Be Separate

Eventually:

```text
Cloud Order State
```

and:

```text
Local Print Job State
```

will have different responsibilities.

For example:

```text
Cloud:
SHOP_ACCEPTED
PRINTING
READY
COMPLETED
```

Local:

```text
DOWNLOADING
VALIDATING
QUEUED
SPOOLING
PRINTING
FAILED
```

The desktop agent should report meaningful local events to the cloud rather than making the cloud reproduce every internal implementation detail.

---

# 17. Durable Queue

A major modification from the original plan is:

> **The queue should be durable, not memory-only.**

Do not rely on:

```rust
VecDeque<PrintJob>
```

as the authoritative queue.

Use a small local persistence layer.

SQLite is a strong choice for V1.

Conceptually:

```text
SQLite
├── jobs
├── job_attempts
├── printers
└── configuration
```

This prevents a restart from losing:

```text
queued jobs
job status
attempt counts
printer mappings
```

---

# 18. Queue Worker

V1 should use a **single-job worker**.

```text
Queue
  ↓
Worker
  ↓
take one job
  ↓
validate
  ↓
select backend
  ↓
print
  ↓
update state
  ↓
next job
```

This deliberately avoids parallel printing initially.

Parallel printing can be introduced later when:

- multiple printers exist
- routing is reliable
- printer concurrency behavior is understood
- job locking is implemented

---

# 19. Idempotency

Every job needs a unique ID.

Example:

```text
job_01J...
```

The agent must not accidentally print the same cloud job twice because of:

```text
network reconnect
duplicate message
Tauri restart
ack timeout
cloud retry
```

Before execution:

```text
Does this job already have a completed attempt?
```

The answer must determine whether another physical print is safe.

This is particularly important once WebSockets are introduced.

---

# 20. Printer Manager

The `PrinterManager` should handle:

```text
discover()
get()
refresh_status()
get_capabilities()
select()
```

It should not itself know how to render a PDF.

---

# 21. Printer Router

The router decides:

```text
Which printer should execute this job?
```

V1 can support:

```text
explicit printer selection
```

and simple capability-based routing.

Example:

```text
Color + A4
     ↓
Find configured color A4 printers
     ↓
Remove offline printers
     ↓
Select configured printer
```

Later:

```text
least busy
fastest
paper availability
cost
priority
```

can be introduced.

---

# 22. PrintBackend Abstraction

Use:

```rust
trait PrintBackend {
    fn discover_printers(...);
    fn get_status(...);
    fn get_capabilities(...);
    fn print(...);
}
```

The exact Rust trait signatures should be designed around asynchronous behavior and error propagation during implementation.

Backends:

```text
WindowsDriverBackend
WindowsRawBackend
MockBackend
```

---

# 23. Windows Driver Backend

This should eventually become the **primary backend for normal documents**.

Its purpose:

```text
PDF/JPG/PNG
    ↓
Windows print configuration
    ↓
Windows printer driver
    ↓
Windows spooler
    ↓
Printer
```

The driver handles printer-specific details.

This is the path PrintKro ultimately needs for ordinary shop printers.

---

# 24. Windows RAW Backend

Keep RAW printing because it is useful and because the existing Go prototype already proves the concept.

However, RAW should be explicitly scoped.

```text
WindowsRawBackend
      ↓
winspool.drv
      ↓
RAW bytes
      ↓
printer
```

ESC/POS support belongs here.

It should support:

- initialization
- text formatting
- line feeds
- cut commands
- valid RAW payload submission
- printer/job validation

It should not become the representation of a PDF print job.

---

# 25. ESC/POS Scope

ESC/POS is primarily useful for:

- thermal receipt printers
- simple text output
- barcode/receipt workflows

It is not the appropriate generic representation for:

- PDF
- JPG
- PNG
- complex document layout

Therefore:

```text
PrintKro PDF
   ↓
WindowsDriverBackend
```

while:

```text
Receipt text
   ↓
WindowsRawBackend
   ↓
ESC/POS
```

This distinction should remain explicit in the architecture.

---

# 26. Mock Backend

Create a mock backend immediately.

It should:

```text
accept job
record job
simulate success
simulate printer failure
simulate offline printer
simulate delayed printing
```

This enables reliable unit/integration testing without a physical printer.

Example:

```text
MockPrinter
MockBackend
```

can be used to test the complete queue worker.

---

# 27. Windows Platform Layer

All Windows-specific code should be isolated.

Example:

```text
platform/windows/
├── printers.rs
├── spooler.rs
└── raw_print.rs
```

The rest of the application should depend on abstractions.

Avoid spreading:

```rust
#[cfg(windows)]
```

through the entire codebase.

The Windows adapter should translate Windows-specific concepts into domain concepts.

---

# 28. Tauri Commands

Recommended initial commands:

```text
list_printers
refresh_printers
get_printer
get_printer_status
get_printer_capabilities

create_test_job
enqueue_job
get_job
list_jobs
cancel_job
retry_job

get_agent_status
get_queue_status

get_config
update_config
```

Commands should return typed serializable structures.

---

# 29. Tauri Events

Events are notifications, not the source of truth.

Example:

```text
agent:status
printer:status
job:created
job:queued
job:started
job:progress
job:completed
job:failed
queue:changed
agent:error
```

If React misses an event, it should be able to query Rust again.

Bad architecture:

```text
React state = source of truth
```

Correct:

```text
Rust persisted state = source of truth

React
  ↓
query current state
  +
subscribe to events
```

---

# 30. Local-First Principle

The desktop agent should continue to function without cloud connectivity.

V1 should be able to:

```text
discover printers
configure printers
create local jobs
queue jobs
print jobs
observe status
```

without requiring the PrintKro cloud.

This makes debugging dramatically easier.

---

# 31. Future Transport Abstraction

Introduce the boundary now, but don't implement cloud transport yet.

Conceptually:

```rust
trait Transport {
    async fn connect(...);
    async fn receive(...);
    async fn send(...);
}
```

V1:

```text
LocalTransport / TestTransport
```

Future:

```text
WebSocketTransport
```

The Go prototype's protocol can become the reference for the future implementation:

```text
hello
welcome
print
ack
ping
pong
reconnect
```

Do not make the Rust core depend directly on WebSocket concepts.

---

# 32. Future Cloud Flow

Eventually:

```text
PrintKro Cloud
      │
      │ WebSocket
      ▼
Transport
      │
      ▼
Agent Core
      │
      ▼
Queue
      │
      ▼
Router
      │
      ▼
PrintBackend
      │
      ▼
Windows
      │
      ▼
Printer
```

The transport delivers commands.

The agent decides what they mean.

The queue decides when they execute.

The backend decides how they print.

---

# 33. Future Cloud Protocol

The future protocol can retain the Go prototype's basic concepts:

```text
Agent → hello
Server → welcome

Server → print(job)
Agent → ack(job)

Server ↔ ping/pong
```

The protocol should eventually include:

```text
job_id
order_id
printer_id
document reference
print options
capability requirements
timestamp
protocol version
```

A protocol version should be included from the beginning of the cloud protocol design.

---

# 34. PDF/Image Printing Pipeline

This is the most important future printing pipeline.

For a PDF:

```text
Print Job
   ↓
Download / locate PDF
   ↓
Validate file
   ↓
Determine page count
   ↓
Validate requested pages
   ↓
Select printer
   ↓
Select Windows Driver Backend
   ↓
Configure print parameters
   ↓
Windows spooler
   ↓
Printer
```

For JPG/PNG:

```text
Image
  ↓
Validate image
  ↓
Determine dimensions
  ↓
Apply print layout
  ↓
Select paper size
  ↓
Select color mode
  ↓
Windows Driver Backend
  ↓
Windows spooler
  ↓
Printer
```

The exact rendering mechanism for PDF/image documents should be selected during implementation after testing Windows APIs and available rendering libraries.

Do not prematurely lock the system to a RAW byte pipeline.

---

# 35. Rendering vs Printing

Separate these concepts.

```text
Document
   ↓
Renderer
   ↓
Printable representation
   ↓
Printer backend
   ↓
Windows
```

Eventually you may have:

```text
PDF Renderer
Image Renderer
Office Renderer
```

and:

```text
Windows Driver Backend
Windows Raw Backend
```

This gives you flexibility.

---

# 36. File Validation

Before printing:

```text
File exists
File readable
File type recognized
File not empty
File not corrupted
File size acceptable
Page count available where applicable
Requested page range valid
```

For cloud documents:

```text
download successful
checksum verified
temporary file available
```

---

# 37. Security

Because PrintKro handles potentially sensitive documents, the local agent should be designed with privacy in mind.

Requirements:

- never expose local document paths to the frontend unnecessarily
- validate file inputs
- restrict temporary storage permissions
- avoid logging document contents
- avoid logging credentials
- use secure cloud transport later
- delete temporary documents after the configured lifecycle
- use short-lived access URLs for cloud downloads
- authenticate the desktop agent before accepting cloud jobs
- do not trust arbitrary incoming print payloads

The broader product architecture already treats document privacy as a foundational requirement rather than a post-MVP feature.

---

# 38. Configuration

Local configuration should include things such as:

```text
shop/device identity
selected printers
printer mappings
backend type
capability overrides
agent settings
queue settings
logging level
```

Do not store sensitive credentials in a plain JSON file.

Windows credential/storage mechanisms should be considered when cloud authentication is introduced.

---

# 39. Agent Lifecycle

V1:

```text
Application starts
    ↓
Initialize configuration
    ↓
Initialize persistence
    ↓
Discover printers
    ↓
Initialize queue
    ↓
Start worker
    ↓
Start Tauri UI
```

Shutdown:

```text
Stop accepting new local jobs
    ↓
Persist current state
    ↓
Stop worker safely
    ↓
Close resources
```

The agent must not silently lose queued jobs during application shutdown.

---

# 40. Error Model

Avoid:

```rust
Err("printer failed")
```

Use structured errors.

Conceptually:

```rust
enum AgentError {
    PrinterNotFound,
    PrinterOffline,
    UnsupportedCapability,
    InvalidDocument,
    EmptyPayload,
    InvalidRawPayload,
    QueueError,
    SpoolerError,
    BackendError,
    DownloadError,
    ConfigurationError,
}
```

Errors should also contain safe human-readable messages and, where useful, diagnostic metadata.

---

# 41. Retry Policy

Not every failure should be retried.

Example:

### Retry

```text
temporary printer offline
temporary spooler failure
temporary download failure
```

### Do not automatically retry

```text
invalid PDF
invalid page range
unsupported printer capability
empty payload
malformed RAW data
```

Otherwise the system could repeatedly attempt a fundamentally invalid job.

---

# 42. Physical Printing and Idempotency

Physical printing has a special problem:

> You cannot always know whether a printer actually produced the pages.

For example:

```text
Agent sends job
       ↓
Windows accepts job
       ↓
Agent loses connection
       ↓
Did the printer print?
```

The system must distinguish:

```text
submission accepted
```

from:

```text
physical printing confirmed
```

V1 should therefore avoid claiming stronger guarantees than Windows/printer telemetry actually provides.

A job can have states such as:

```text
SUBMITTED_TO_SPOOLER
PRINTING
COMPLETED
UNKNOWN
```

where appropriate.

This is preferable to pretending that every spooler response means physical completion.

---

# 43. Queue Recovery

On restart:

```text
SQLite
 ↓
find non-terminal jobs
 ↓
inspect previous state
 ↓
recover safely
```

Terminal:

```text
COMPLETED
CANCELLED
```

Non-terminal:

```text
QUEUED
PRINTING
RETRY_PENDING
```

Recovery policy must be explicit.

Do not automatically duplicate a job that may already have physically printed.

---

# 44. Test Strategy

Tests should be layered.

## Unit tests

Test:

```text
domain serialization
job validation
page range validation
capability matching
state transitions
retry classification
routing
ESC/POS generation
structured errors
```

## Backend tests

Mock:

```text
printer discovery
printer offline
spooler failure
successful submission
invalid payload
```

## Queue tests

Test:

```text
enqueue
dequeue
single worker
failure
retry
restart recovery
duplicate job
idempotency
```

## Frontend tests

Verify:

```text
commands are called correctly
events update presentation
no Windows logic exists in React
```

---

# 45. ESC/POS Tests

The RAW backend should have deterministic tests.

Given:

```text
"Hello"
```

verify the generated payload contains the expected initialization, text, line feeds, and cut sequence.

Also test:

```text
empty text
empty bytes
invalid input
very large payload
```

Do not require a physical printer for these tests.

---

# 46. Integration Test

On an actual Windows machine:

```text
React
 ↓
Tauri command
 ↓
Rust
 ↓
PrinterManager
 ↓
Windows adapter
 ↓
Windows spooler
 ↓
physical printer
```

Verification:

1. Discover installed printers.
2. Select one.
3. Submit a small test job.
4. Confirm Windows accepts it.
5. Confirm the printer produces the expected output.
6. Verify job state transitions.
7. Verify failure behavior.

---

# 47. Focused V1 Test Console

Replace the generated scaffold with a deliberately technical console.

Example:

```text
PRINTKRO AGENT

Agent
● Running

Printers
────────────────────────
✓ HP LaserJet
  Online

✓ Canon Color
  Online

Selected:
[ Canon Color ]

Printer Details
────────────────────────
Status: Online
Color: Yes
A4: Yes
A3: No

Test Job
────────────────────────
Payload:
[ Hello from PrintKro ]

[ Submit Test Job ]

Queue
────────────────────────
job_001   QUEUED
job_000   COMPLETED

Events
────────────────────────
12:32:10 printer discovered
12:32:11 job queued
12:32:12 spooler accepted
12:32:15 job completed
```

The goal of this UI is not beauty.

The goal is to make native integration observable.

---

# 48. Recommended Implementation Order

## Phase 0 — Architecture

Define:

- domain models
- state machine
- backend trait
- queue interfaces
- printer interfaces
- error types
- event contracts

Do this before large amounts of implementation.

---

## Phase 1 — Printer Discovery

Implement:

```text
Rust
 ↓
Windows
 ↓
installed printers
```

Expose:

```text
list_printers
```

to React.

Success criterion:

> React can refresh and display installed Windows printers.

---

## Phase 2 — Printer Status

Implement:

```text
online
offline
paused
error
unknown
```

where supported.

Success criterion:

> UI can display current printer status.

---

## Phase 3 — Mock Backend

Build the mock backend.

Use it to prove:

```text
job
 ↓
queue
 ↓
worker
 ↓
backend
 ↓
completed
```

without hardware.

---

## Phase 4 — Durable Queue

Add SQLite persistence.

Prove:

```text
enqueue
restart application
recover job
continue safely
```

---

## Phase 5 — RAW Backend

Port the useful Windows RAW functionality from the Go prototype.

Implement:

```text
winspool.drv
RAW
ESC/POS
```

Success criterion:

> A test payload reaches the Windows spooler and prints correctly.

---

## Phase 6 — Driver-Based Document Backend

This is the critical PrintKro step.

Build the normal document backend around:

```text
PDF
JPG
PNG
```

rather than RAW.

Establish:

```text
document
 ↓
renderer / print preparation
 ↓
Windows driver
 ↓
spooler
 ↓
printer
```

The exact renderer/API should be chosen based on the Windows implementation constraints discovered during this phase.

---

## Phase 7 — Document Validation

Implement:

```text
file validation
page count
page selection
paper size
color mode
copies
```

---

## Phase 8 — Routing

Implement:

```text
job requirements
      ↓
capability matching
      ↓
available printers
      ↓
selected printer
```

Keep the first routing algorithm deterministic and simple.

---

## Phase 9 — Tauri Events

Expose:

```text
job started
job completed
job failed
printer changed
queue changed
agent error
```

React becomes a live monitoring interface.

---

## Phase 10 — Reliability

Test:

```text
printer unplugged
printer offline
spooler error
application restart
duplicate job
invalid file
invalid page range
backend failure
```

---

## Phase 11 — Cloud Transport Boundary

Only after local printing works:

```text
Transport trait
     ↓
WebSocket implementation
```

Port the Go protocol behavior conceptually:

```text
hello
welcome
print
ack
ping
pong
reconnect
```

Do not copy the Go architecture wholesale.

Reuse the protocol knowledge while keeping the Rust architecture clean.

---

# 49. What Should NOT Be Built in V1

Do not build:

- marketplace
- customer accounts
- advanced printer optimization
- toner prediction
- inventory
- CRM
- staff management
- accounting
- advanced analytics
- complex printer telemetry
- multi-process agent architecture
- automatic printer load balancing
- cloud WebSocket implementation before local printing works
- full Office document rendering unless required for the first prototype
- duplex support unless specifically required
- finishing/binding/stapling
- complicated print scheduling

The purpose of V1 is:

> **Prove that PrintKro can reliably turn a local print command into a physical document.**

---

# 50. Definition of Done

V1 is successful when the following flow works:

```text
React
  ↓
Select Windows printer
  ↓
Create print job
  ↓
Rust validates job
  ↓
Rust queues job
  ↓
Worker picks job
  ↓
Correct backend selected
  ↓
Windows printing API
  ↓
Windows spooler
  ↓
Physical printer
  ↓
Rust records result
  ↓
React receives event
```

For document printing:

```text
PDF/JPG/PNG
   ↓
validated
   ↓
print options applied
   ↓
Windows driver path
   ↓
printed
```

For RAW/ESC-POS:

```text
RAW payload
   ↓
validated
   ↓
Windows RAW backend
   ↓
spooler
   ↓
thermal printer
```

---

# 51. Final Recommended Architecture

```text
                         PRINTKRO CLOUD
                              │
                              │ Future WebSocket
                              ▼
                         Transport
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                 PRINTKRO SHOP DESKTOP                  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                React / TypeScript                 │  │
│  │                                                   │  │
│  │ Dashboard │ Printers │ Jobs │ Queue │ Settings    │  │
│  └────────────────────────┬──────────────────────────┘  │
│                           │                             │
│                    Tauri Commands                       │
│                    Tauri Events                         │
│                           │                             │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │                  RUST AGENT CORE                  │  │
│  │                                                  │  │
│  │ Agent Service                                    │  │
│  │ Job State Machine                                 │  │
│  │ Durable Queue                                    │  │
│  │ Printer Manager                                  │  │
│  │ Printer Router                                   │  │
│  │ Configuration                                    │  │
│  │ Retry / Recovery                                 │  │
│  └───────────────┬──────────────────┬───────────────┘  │
│                  │                  │                  │
│        ┌─────────▼─────────┐   ┌────▼──────────────┐  │
│        │   PrintBackend    │   │     Transport     │  │
│        │                   │   │                   │  │
│        │ Windows Driver    │   │ Local/Test        │  │
│        │ Windows RAW       │   │ WebSocket Future  │  │
│        │ Mock              │   │                   │  │
│        └─────────┬─────────┘   └───────────────────┘  │
│                  │                                    │
│        ┌─────────▼────────────────────────────────┐   │
│        │          Windows Platform Layer           │   │
│        │                                           │   │
│        │ Printer Discovery                         │   │
│        │ Printer Status                            │   │
│        │ winspool.drv                              │   │
│        │ Windows Spooler                           │   │
│        └─────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           │
                           ▼
                    Printer Driver
                           │
                           ▼
                    Physical Printer
```

---

# 52. The Core Principle

The architecture should ultimately follow this separation:

```text
React
"What does the shop employee see?"

Tauri
"How does the UI call the native application?"

Rust Agent Core
"What should happen to this print job?"

Queue
"When should it happen?"

Router
"Which printer should handle it?"

Print Backend
"How do we turn this print operation into printer input?"

Windows Adapter
"How do we communicate with Windows?"

Windows Spooler / Driver
"How does Windows communicate with the hardware?"

Printer
"Produce the physical output."
```

This gives PrintKro a clean foundation for its actual moat: **reliable automated document printing**, rather than a desktop UI that happens to have a print button.

---

# 53. Recommended V1 Priority

If implementation time becomes constrained, prioritize in exactly this order:

```text
1. Windows printer discovery
2. Rust printer abstraction
3. Durable local queue
4. Mock backend
5. Windows RAW backend
6. PDF/image driver-based backend
7. Job state machine
8. Failure/recovery
9. Printer capability model
10. Simple routing
11. Tauri events
12. Cloud transport
```

The most important milestone is not the dashboard.

It is:

> **Give PrintKro a PDF, choose a Windows printer, press Print, and reliably get the physical pages out—while the Rust agent knows what happened.**
