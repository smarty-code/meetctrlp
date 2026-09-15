# PrintKro Shop Desktop Agent

The first prototype validates the local native print channel:

```text
React → Tauri command → Rust agent state → printer backend → Windows spooler
```

The current console supports printer discovery, selection, and a local text test job. On Windows, the backend follows the prototype agent's RAW/ESC-POS path through `winspool.drv`. On non-Windows development machines, a deterministic development printer is exposed so the React-to-Rust boundary can still be exercised.

The Rust side owns printer access and job state. React only invokes typed commands and displays returned state. Cloud WebSocket transport, normal PDF/image driver printing, and cloud authentication remain subsequent implementation slices.

Development progress and verification instructions are maintained in [the developer devlog](../../docs/arc/SHOP_DESKTOP_AGENT_V1_DEVLOG.md).

## Native commands

- `list_printers`
- `select_printer`
- `get_agent_status`
- `create_test_job`
- `get_job`

## Local protocol

`create_test_job` returns a queued receipt. The single Rust worker then moves the job through `printing` to `completed` or `failed`. Job records are stored under the platform data directory in `PrintKro/agent-jobs.json`, and non-terminal jobs are recovered when the application starts. The UI listens for `job:changed` and can query `get_job` as a recovery path.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
