# Order-to-print execution runbook

This runbook covers the Windows shop desktop order loop. It is for a local Firebase/emulator or explicitly configured development server only; never use its seed command against production.

## Shipped flow

1. A document intake request creates an order with immutable file metadata: MIME type (`application/pdf`, `image/png`, or `image/jpeg`), byte count, SHA-256, page count, and print configuration.
2. Cash orders remain `SUBMITTED` until a shop operator accepts them. A verified `ONLINE` payment callback may move an order to `SHOP_ACCEPTED` when the shop policy enables `autoAcceptPaidOnline`.
3. Accepted orders auto-dispatch only when `autoDispatchAcceptedOrders` is enabled and an enabled online printer advertises the requested paper/color capability.
4. Firestore contains an idempotent document-level `printJob`, addressed with the Firestore printer ID: one job per document. Its assigned agent receives `printerSystemName` for the Windows queue. A document can be dispatched while the order is `SHOP_ACCEPTED` or `PRINTING`. The first claimed job moves the order to `PRINTING`, and the remaining documents must still dispatch.
5. The detached C# agent polls only its assigned jobs, claims a lease, obtains a short-lived ticket, stages the file under `%LOCALAPPDATA%\Ctrlp\PrintAgent\jobs\{cloudJobId}`, verifies SHA-256, then inserts a correlated SQLite `queue.db` job.
   - **One job at a time:** each polled job is staged on its own. A failure on one job is logged and the rest of the batch continues.
   - **Failures after a claim:** if staging fails after a successful claim (ticket, download, or hash mismatch), the agent reports the job `FAILED` with `AGENT_STAGING_FAILED`. The operator can then retry or reassign it, instead of it staying leased in `DISPATCHING`.
   - **Retries:** claim and stage idempotency keys include the job's `retryCount` (`agent-claim-{jobId}-{retryCount}`, `agent-stage-{jobId}-{retryCount}`). A job re-queued by a cloud retry is therefore claimed and staged again rather than replaying the first attempt.
6. The worker renders PDF through PDFium (`Docnet.Core`), or loads PNG/JPEG, and submits pages through `PrintDocument`. It captures the spooler ID if the driver leaves it observable. Successful staged files are deleted; failed files remain only for an operator retry.
7. Agent progress updates the cloud job and order stream. All required document jobs must complete before the server moves the order to `READY`. Cash is recorded at `READY`; pickup completion remains an explicit operator action.
   - **Report order:** status reports are sent without waiting, so `COMPLETED` can arrive before `PRINTING`. The server therefore accepts `DISPATCHING → COMPLETED`.
   - **Acknowledgement:** the agent marks a local job as acknowledged only after a final report (`COMPLETED`, `FAILED`, `CANCELLED`) succeeds. If that report is lost, the next sync sends it again.
   - **Known gap:** **Mark ready for pickup** does not check that every document has a job, so an operator can finish an order early.
   - **Known gap:** reassigning a failed job changes only `printerId`, not the agent or Windows printer name.

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
| Multi-document order | 5 mixed PDFs and photos in one order, auto-dispatch on and off | every document gets a job and prints; the order reaches `READY` by itself |
| Staging failure | corrupt the stored object or block the download for one document of a multi-document order | that job turns `FAILED` (`AGENT_STAGING_FAILED`), the other documents still print, and retry prints it |
| Printer outage | offline/paused/driver error then retry/reassign | job reports failure, no uncertain in-flight automatic retry |
| Cash | accept → print → READY → tender ≥ total → complete | change and collector are recorded; completion before cash is rejected |
| Online | verified callback with policy enabled | paid order accepts/dispatches; duplicate callback idempotency key is safe |
| Restart | stop/restart agent while queued and while printing | queued work resumes; ambiguous active work becomes explicit retryable failure |

## Automated verification

Run from the repository root:

```powershell
pnpm --filter @ctrlp/schemas typecheck
pnpm --filter @ctrlp/schemas test
pnpm --filter server typecheck
pnpm --filter server test
pnpm --filter print-shop typecheck
pnpm --filter print-shop test
cargo check --manifest-path apps/print-shop/src-tauri/Cargo.toml
dotnet test .\apps\print-agent\Ctrlp.PrintAgent.sln -c Release
```

Current automated coverage validates:

- TypeScript contracts and UI reducers.
- Shop-hours rules and validation.
- Guest-cart helpers and PDF page counting.
- The agent queue's persistence, claim, cancel, and retry behaviours.

The agent's cloud synchronizer (claim, stage, report) has no automated test. The physical Windows matrix above remains required because driver spool semantics cannot be reproduced in a cross-platform test.
