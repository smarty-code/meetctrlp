# PrintKro Shop Desktop Agent

The first prototype validates the local native print channel:

```text
React → Tauri command → Rust agent state → printer backend → Windows spooler
```

The current console supports printer discovery, selection, and a local PDF/JPG/PNG print job. On Windows, the backend rasterizes the document and submits it through the printer driver and Windows spooler. On non-Windows development machines, a development printer accepts the same job contract so the React-to-Rust boundary can still be exercised.

The Rust side owns printer access and job state. React only invokes typed commands and displays returned state. Cloud WebSocket transport and cloud authentication remain subsequent implementation slices.

Development progress and verification instructions are maintained in [the developer devlog](../../docs/arc/SHOP_DESKTOP_AGENT_V1_DEVLOG.md).

## Native commands

- `list_printers`
- `select_printer`
- `get_agent_status`
- `create_print_job`
- `validate_document_job`
- `get_job`

## Local document testing

1. Start the app with `pnpm tauri dev` on Windows.
2. Click `Refresh printers`; no PowerShell window should appear.
3. Select an installed printer.
4. Click `Choose PDF or photo` and select a `.pdf`, `.jpg`, `.jpeg`, or `.png` file.
5. Click `Print selected file`.
6. Confirm the job receipt reports success and inspect the printer output.

The current document backend uses the Windows `PrintTo` verb targeted at the selected printer. It avoids the interactive print dialog, but the associated PDF/image application still controls document rendering. Copies are submitted one at a time; explicit page ranges are intentionally rejected until the dedicated Windows driver backend is implemented.

## Local protocol

`create_print_job` returns a queued receipt. The single Rust worker then moves the job through `printing` to `completed` or `failed`. Job records are stored under the platform data directory in `PrintKro/agent-jobs.json`, and non-terminal jobs are recovered when the application starts. The UI listens for `job:changed` and can query `get_job` as a recovery path.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
