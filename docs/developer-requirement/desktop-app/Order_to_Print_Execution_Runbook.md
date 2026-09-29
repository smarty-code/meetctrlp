# Order-to-print execution runbook

This runbook covers the Windows shop desktop order loop. It is for a local Firebase/emulator or explicitly configured development server only; never use its seed command against production.

## Shipped flow

1. A document intake request creates an order with immutable file metadata: MIME type (`application/pdf`, `image/png`, or `image/jpeg`), byte count, SHA-256, page count, and print configuration.
2. Cash orders remain `SUBMITTED` until a shop operator accepts them. A verified `ONLINE` payment callback may move an order to `SHOP_ACCEPTED` when the shop policy enables `autoAcceptPaidOnline`.
3. Accepted orders auto-dispatch only when `autoDispatchAcceptedOrders` is enabled and an enabled online printer advertises the requested paper/color capability.
4. Firestore contains an idempotent document-level `printJob`, addressed with the Firestore printer ID. Its assigned agent receives `printerSystemName` for the Windows queue.
5. The detached C# agent polls only its assigned jobs, claims a lease, obtains a short-lived ticket, stages the file under `%LOCALAPPDATA%\Ctrlp\PrintAgent\jobs\{cloudJobId}`, verifies SHA-256, then inserts a correlated SQLite `queue.db` job.
6. The worker renders PDF through PDFium (`Docnet.Core`), or loads PNG/JPEG, and submits pages through `PrintDocument`. It captures the spooler ID if the driver leaves it observable. Successful staged files are deleted; failed files remain only for an operator retry.
7. Agent progress updates the cloud job and order stream. All required document jobs must complete before the server moves the order to `READY`. Cash is recorded at `READY`; pickup completion remains an explicit operator action.

## Credentials and data handling

- The UI stores a refresh token and the sidecar stores a device-scoped agent credential in Windows Credential Manager. The agent never receives a Firebase ID token.
- Do not log document bytes, local document paths, signed URLs, or credentials.
- `CTRLP_PAYMENT_WEBHOOK_SECRET` is required by `POST /api/v1/internal/payments/shops/{shopId}/orders/{orderId}/confirmed`. Send it only as `x-ctrlp-payment-secret`; calls require a UUID idempotency key and a gateway payment reference.
- A server download ticket must not be reused after the document shred marker. Remote object deletion is still a follow-up item.

## Development seed

Start a local server/emulator and provide a development shop operator token:

```powershell
$env:SERVER_BASE_URL = "http://localhost:3000"
$env:SHOP_ID = "<development-shop-id>"
$env:SHOP_TOKEN = "<development-operator-id-token>"
$env:FIXTURE = "pdf" # pdf | png | jpeg
$env:PAYMENT_METHOD = "CASH" # CASH | ONLINE
pnpm --filter server seed:print-order
```

The script rejects any base URL that is not localhost/emulator-like. It uses the normal multipart document intake API and prints the generated order/document IDs. It does not write Firestore records directly.

## Windows manual matrix

Run the following on Microsoft Print to PDF and, separately, one physical printer. Confirm no duplicate output after a desktop close/relaunch.

| Input | Variants | Expected |
| --- | --- | --- |
| PDF | single page, multiple page, `1,3,5-8`, A4/A3, BW/color | correct selected pages submit; incompatible color/A3 is rejected before dispatch |
| PNG/JPEG | A4, BW/color, multiple copies | page fits driver margins and requested copies submit |
| Printer outage | offline/paused/driver error then retry/reassign | job reports failure, no uncertain in-flight automatic retry |
| Cash | accept → print → READY → tender ≥ total → complete | change and collector are recorded; completion before cash is rejected |
| Online | verified callback with policy enabled | paid order accepts/dispatches; duplicate callback idempotency key is safe |
| Restart | stop/restart agent while queued and while printing | queued work resumes; ambiguous active work becomes explicit retryable failure |

## Automated verification

Run from the repository root:

```powershell
pnpm --filter @ctrlp/schemas typecheck
pnpm --filter server typecheck
pnpm --filter print-shop typecheck
pnpm --filter print-shop test
cargo check --manifest-path apps/print-shop/src-tauri/Cargo.toml
dotnet test .\apps\print-agent\Ctrlp.PrintAgent.sln -c Release
```

Current automated coverage validates TypeScript contracts and UI reducers plus the agent queue persistence/claim/cancel/retry behaviors. The physical Windows matrix above remains required because driver spool semantics cannot be reproduced in a cross-platform test.
