# PrintKro Shop Desktop Agent V1 Devlog

Developer log for implementing [the V1 architecture](SHOP_DESKTOP_AGENT_V1.md).

## How to use this log

Each phase records:

- what changed
- why the change exists
- how to run or test it
- what is still deliberately out of scope
- the gate for the next phase

Update this file after each implementation phase. Keep the entries chronological and do not mark a phase complete until its verification steps have been run or the unavailable checks are explicitly recorded.

## Current Status

| Phase | Status | Evidence |
| --- | --- | --- |
| Phase 1: Printer discovery and native boundary | Complete | Desktop frontend build and editor diagnostics pass; Windows spooler path requires a Windows machine with a printer. |
| Phase 2: Local worker and durable queue | Complete | File-backed store, restart recovery, queue-store test, frontend build, Rust compilation, and all unit tests pass on Linux. |
| Phase 3: Normalized document jobs | Complete | PDF/JPG/PNG domain payloads and validation are implemented; printing them is the next phase. |
| Phase 4: Windows driver backend | Next | Concrete PDF/image rendering and driver submission are not implemented yet. |
| CI: Windows installer release | Complete | GitHub Actions workflow builds and publishes draft `.exe` and `.msi` installers on `shop-desktop-v*` tags. |
| CI: Windows spooler linker fix | Complete | The Windows build now links the SDK import library as `winspool.lib` instead of looking for the invalid `winspool.drv.lib`. |
| Phase 5: Local document print path | Complete | File picker, hidden PowerShell discovery, selected-printer document submission, and local PDF/image testing are implemented. |
| CI: Windows CommandExt scope fix | Complete | `CommandExt` is imported inside the nested Windows printer module where `creation_flags` is called. |

## Phase 1: Printer Discovery and Native Boundary

### Goal

Prove the initial communication channel:

```text
React → Tauri command → Rust backend → printer adapter
```

### Implementation

- Replaced the generated `greet` command in `apps/shopPartnerDesktopApp/src-tauri/src/lib.rs`.
- Added typed domain models in `src-tauri/src/domain.rs`.
- Added the `PrinterBackend` trait and local backend in `src-tauri/src/printer.rs`.
- Added Tauri commands for printer listing, selection, status, test jobs, and job lookup.
- Added Windows printer discovery through PowerShell `Get-Printer`.
- Added Windows RAW printing through `winspool.drv`.
- Added ESC/POS initialization, line feeds, and cut bytes for text test jobs.
- Replaced the generated React screen with a printer-agent test console.

### How to test

From the repository root:

```bash
pnpm --dir apps/shopPartnerDesktopApp build
```

This verifies the React and TypeScript side.

From a machine with Rust installed:

```bash
cd apps/shopPartnerDesktopApp/src-tauri
cargo fmt --check
cargo check
cargo test
```

Run the Tauri development app on a Windows machine with an installed printer:

```bash
cd apps/shopPartnerDesktopApp
pnpm tauri dev
```

Then verify:

1. The Printers section lists installed Windows printers.
2. Selecting a printer updates the selected-device panel.
3. A non-empty test payload creates a queued job.
4. The job changes to `printing`, then `completed` or `failed`.
5. The printer receives the RAW/ESC-POS payload.

On Linux/macOS, the backend exposes a deterministic development printer. That validates React/Tauri/Rust wiring but cannot validate `winspool.drv` or physical output.

### Failure checks

- Empty text must be rejected.
- Unknown printer IDs must be rejected.
- Empty RAW payloads must be rejected by the Windows adapter.
- A spooler failure must produce a failed job receipt rather than silently reporting success.

## Phase 2: Local Worker and Durable Queue

### Goal

Move printing out of the Tauri command handler and retain job state across application restarts.

### Implementation

- Added `src-tauri/src/queue.rs` with a file-backed JSON queue store.
- The store writes through a temporary file and atomic rename to avoid partially written queue files.
- The default location is:
  - Windows: `%APPDATA%/PrintKro/agent-jobs.json`
  - Linux: `$XDG_DATA_HOME/PrintKro/agent-jobs.json`, or `$HOME/.local/share/PrintKro/agent-jobs.json`
  - fallback: `./PrintKro/agent-jobs.json`
- Jobs are saved before entering the worker channel.
- The single worker persists `printing`, `completed`, and `failed` transitions.
- Jobs left in `queued` or `printing` state are recovered on startup. A recovered `printing` job is reset to `queued` before retrying.
- React receives `job:changed` events and retains `get_job` polling as a recovery path.
- Added a queue-store persistence test.

### How to test

Run the frontend check:

```bash
pnpm --dir apps/shopPartnerDesktopApp build
```

Run Rust checks where the toolchain is installed:

```bash
cd apps/shopPartnerDesktopApp/src-tauri
cargo fmt --check
cargo check
cargo test
```

Manual recovery test:

1. Start the Tauri app.
2. Submit a test job.
3. Inspect the platform queue file and confirm the job record exists.
4. Stop and restart the app.
5. Confirm terminal jobs remain visible in the store.
6. For a job interrupted in `queued` or `printing`, confirm startup returns it to the worker.
7. Confirm the React receipt updates through `job:changed`.

### Important limitation

This phase uses a file-backed store to keep the first durable contract small. SQLite can replace the store once the normalized document-job schema and attempt history are finalized. The `QueueStore` boundary is intentionally isolated so that migration does not affect React or printer backends.

## Developer Test Matrix

| Area | Command or action | Expected result |
| --- | --- | --- |
| Frontend typecheck/build | `pnpm --dir apps/shopPartnerDesktopApp build` | Vite build succeeds. |
| Rust formatting | `cargo fmt --check` | No formatting changes required. |
| Rust compile | `cargo check` | Tauri crate and native modules compile for the target platform. |
| Rust unit tests | `cargo test` | Domain and queue-store tests pass. |
| Printer discovery | Tauri app on Windows | Installed printers appear in the UI. |
| Local test print | Select printer, submit text | Job reaches the backend and produces output. |
| Invalid input | Empty content or unknown printer | Typed command error is shown; no job is queued. |
| Restart recovery | Stop/start with non-terminal job | Job is recovered according to the documented policy. |
| Event recovery | Miss or delay an event | `get_job` still provides the current receipt. |
| Document validation | Call `validate_document_job` with a local file or bytes | Supported document type and print options are accepted; invalid input is rejected. |

## Environment Notes

- Cargo is installed after loading `source "$HOME/.cargo/env"`.
- Linux GTK development packages are installed and Tauri now compiles successfully.
- `cargo fmt --check`, `cargo check`, and `cargo test` pass. The Rust test suite currently reports 8 passing tests.
- The installed Rust target on this machine is `x86_64-unknown-linux-gnu`; Windows-native code still requires a Windows build target and Windows validation.
- The frontend build does not exercise Windows APIs.
- Physical printer verification requires Windows, an installed printer, and a printer compatible with the selected backend.
- Do not interpret `StartDocPrinter` success as proof that pages physically came out. The later job model must distinguish spooler submission from physical completion where Windows telemetry permits.

## Phase 3: Normalized Document Jobs

### Goal

Keep ordinary document printing separate from the RAW/ESC-POS test path.

### Implementation

- Added `PrintJob`, `DocumentSource`, `PrintOptions`, `ColorMode`, and `PageSelection` to the Rust domain.
- Supported document extensions are currently PDF, JPG, JPEG, and PNG.
- Local files must exist, be regular files, and be non-empty.
- Byte documents must be non-empty and include a supported filename extension.
- Copies must be at least one.
- Page numbers must be positive when an explicit page selection is supplied.
- Added the `validate_document_job` Tauri command and unit tests.
- No document job is sent to the RAW backend. This phase only establishes the safe domain contract.

### How to test

```bash
cd apps/shopPartnerDesktopApp/src-tauri
cargo test domain
```

The test suite covers empty documents, unsupported types, invalid copies, invalid page numbers, and a valid PNG-shaped byte payload. The valid byte test checks the domain contract only; it does not claim the bytes are a decodable image.

From the frontend or Tauri developer console, invoke `validate_document_job` with a payload shaped like:

```json
{
  "id": "job-1",
  "printer_id": "printer-1",
  "document": {
    "bytes": [1, 2, 3],
    "file_name": "document.png"
  },
  "options": {
    "color_mode": "color",
    "paper_size": "A4",
    "copies": 1,
    "page_selection": "all"
  }
}
```

### Phase result

The domain no longer treats every print request as text or ESC/POS bytes. The next backend must consume `PrintJob` and select a Windows driver path for normal documents.

## Next Phase Gate: Windows Driver Backend

Begin Phase 4 only after the current local loop is accepted. The next implementation should:

1. Replace `PrintTestJob` as the primary model with `PrintJob` and `DocumentSource`.
2. Add PDF/JPG/PNG metadata and print options without coupling them to RAW bytes.
3. Add validation for file existence, type, size, page range, copies, color mode, and paper size.
4. Keep `WindowsRawBackend` for explicit RAW jobs.
5. Introduce a separate driver-backend interface for ordinary documents.
6. Add tests before selecting the concrete Windows PDF/image rendering mechanism.

## Phase 5: Local Document Print Path

### Goal

Allow a shop operator to choose a local PDF or photo and submit it through the Rust agent to a selected printer without opening the Windows print dialog.

### Implementation

- Added `tauri-plugin-dialog` and the `dialog:default` capability.
- Added `Choose PDF or photo` to the React console.
- Added `print_document_job` as a Rust/Tauri command.
- Added `print_document` to the printer backend boundary.
- Hid Windows PowerShell discovery with `CREATE_NO_WINDOW`.
- Added a Windows document path using `Start-Process -Verb PrintTo` targeted at the selected printer.
- Copies are submitted as separate print-to operations.
- Explicit page selections are rejected until the dedicated driver backend supports them.

### How to test on Windows

```bash
cd apps/shopPartnerDesktopApp
pnpm tauri dev
```

1. Click `Refresh printers` and confirm no PowerShell window appears.
2. Select a discovered printer.
3. Click `Choose PDF or photo`.
4. Select a PDF, JPG, JPEG, or PNG file.
5. Click `Print selected file`.
6. Confirm the selected printer receives the job without showing a print dialog.
7. Confirm the receipt and printer output.

### Important limitation

This is the first local document path, not yet the final PrintKro renderer. Windows uses the registered application for the file type to implement `PrintTo`, so that application controls document rendering. The next driver-backend phase should replace this shell-association path with controlled PDF/image rendering and Windows driver submission.

## CI: Windows Installer Release

### Goal

Build an installable Windows application in GitHub Actions without requiring a Windows development machine locally.

### Implementation

- Added `.github/workflows/shop-desktop-release.yml`.
- The workflow runs on `windows-latest`.
- It installs pnpm, Node.js, and the MSVC Rust toolchain.
- It installs the monorepo with `pnpm install --frozen-lockfile`.
- It runs `cargo fmt --check` and `cargo test` before packaging.
- It runs the Tauri build using the existing `tauri.conf.json` bundle targets.
- It creates a draft GitHub Release with the generated Windows installers.
- It uploads the NSIS `.exe` and MSI files as workflow artifacts.

### Checkout path requirement

All tracked paths must be valid on Windows. In particular, directory and file names must not end with spaces. The repository previously contained `docs/developer-requirement ` with a trailing space; it was renamed to `docs/developer-requirement` so the Windows runner can complete `actions/checkout`.

The workflow also uses sparse checkout and intentionally excludes `docs/` from the Windows build workspace. This protects releases built from older tags while the path rename propagates through the repository history.

### Release procedure

Create and push a desktop release tag from the repository root:

```bash
git tag shop-desktop-v0.1.0
git push origin shop-desktop-v0.1.0
```

The workflow will create a draft release. Review the release, then publish it. The normal installer is the NSIS `.exe`; the `.msi` is available for managed Windows deployment.

The workflow can also be started manually from the GitHub Actions UI by entering an existing tag such as `shop-desktop-v0.1.0`.

### Signing

The current workflow produces unsigned installers. Before distributing broadly, configure Tauri signing secrets in the repository:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

The workflow already contains the commented environment hooks for those secrets. Code-signing the Windows installer itself should also be added before production distribution; that requires a Windows code-signing certificate and secure CI secret storage.

### Verification

After the workflow finishes:

1. Open the draft GitHub Release.
2. Download the `.exe` installer.
3. Install it on a Windows machine.
4. Launch the application and confirm the printer console opens.
5. Confirm the application can discover a Windows printer.
6. Submit a test job and verify the Windows spooler/printer behavior.
7. Keep the `.msi` for enterprise deployment or Windows installer testing.

### Windows linker incident: `winspool.drv.lib`

The Windows release job initially failed while linking Rust tests and the application:

```text
LINK : fatal error LNK1181: cannot open input file 'winspool.drv.lib'
```

The native Windows API calls load `winspool.drv` at runtime, but MSVC links against the Windows SDK import library named `winspool.lib`. The Rust declaration in `src-tauri/src/printer.rs` now uses:

```rust
#[link(name = "winspool")]
```

This preserves the runtime DLL behavior while allowing the MSVC linker to resolve the correct SDK library. The Windows-only printer imports were also scoped to remove non-Windows warnings.

Local verification after the fix:

```bash
cargo fmt --check
cargo check
cargo test
```

Result: compilation succeeded and all 8 tests passed. The next release must be created from a commit containing this fix, not from the earlier failing tag.

### Windows compile incident: `creation_flags`

The release build then failed with:

```text
error[E0599]: no method named `creation_flags` found for struct `std::process::Command`
```

`CommandExt` had been imported in the parent `platform` module, while `creation_flags` was called in the nested `platform::windows` module. Rust trait imports are scoped per module, so the nested module could not resolve the extension method. The import now sits beside `std::process::Command` inside `platform::windows`.

Local verification after the fix:

```bash
cargo fmt --check
cargo check
cargo test
```

Result: compilation succeeded and all 8 tests passed. Create the next Windows release from the commit containing this scope fix.