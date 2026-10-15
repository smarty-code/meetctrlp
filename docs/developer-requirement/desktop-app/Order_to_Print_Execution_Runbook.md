# Order-to-print execution runbook

This runbook covers the Windows shop desktop order loop. It is for a local Firebase/emulator or explicitly configured development server only; never use its seed command against production.

## Shipped flow

1. A document intake request creates an order with immutable file metadata: MIME type (`application/pdf`, `image/png`, or `image/jpeg`), byte count, SHA-256, page count, and print configuration.
2. Cash orders remain `SUBMITTED` until a shop operator accepts them. A verified `ONLINE` payment rings the shop's doorbell; when the shop policy enables `autoAcceptPaidOnline`, the agent's next `sync` moves the order to `SHOP_ACCEPTED`. The payment callback itself no longer accepts, so a paid order waits in `SUBMITTED` while the shop's PC is off.
3. Accepted orders auto-dispatch only when `autoDispatchAcceptedOrders` is enabled and an enabled online printer advertises the requested paper/color capability.
4. Firestore contains an idempotent document-level `printJob`, addressed with the Firestore printer ID: one job per document. Its assigned agent receives `printerSystemName` for the Windows queue. A document can be dispatched while the order is `SHOP_ACCEPTED` or `PRINTING`. The first claimed job moves the order to `PRINTING`, and the remaining documents must still dispatch.
5. The detached C# agent waits on the shop's doorbell. When `workAt` changes (or on start, a network return, or **Sync now**), it calls `POST /api/v1/shops/{shopId}/agents/{agentId}/sync`. One sync accepts paid orders (step 2), claims this agent's `QUEUED` jobs with a fresh lease, hands back jobs stuck in `DISPATCHING` for 15 minutes, and returns a 60-minute download link per job. It repeats while the response says `more`. The agent stages each file under `%LOCALAPPDATA%\Ctrlp\PrintAgent\jobs\{cloudJobId}`, verifies SHA-256, then inserts a correlated SQLite `queue.db` job.
   - **One job at a time:** each claimed job is staged on its own. A failure on one job is logged and the rest of the batch continues.
   - **Failures after a claim:** if staging fails (download or hash mismatch), the agent records the job `FAILED` with `AGENT_STAGING_FAILED` and reports it. The operator can then retry or reassign it, instead of it staying leased in `DISPATCHING`.
   - **Duplicates:** a job is de-duplicated locally by job ID plus lease. A re-delivered job (same lease) is not staged twice; a job re-queued by a cloud retry gets a new lease and is staged again.
   - **Retry backoff:** a failed sync is retried after 2 s, doubling to 60 s. A successful sync waits for the next ring (or, in polling mode, the next 60 s check).
6. The worker renders PDF through PDFium (`Docnet.Core`), or loads PNG/JPEG, and submits pages through `PrintDocument`. It captures the spooler ID if the driver leaves it observable. Successful staged files are deleted; failed files remain only for an operator retry.
7. The agent reports final results (`COMPLETED`, `FAILED`, `CANCELLED`) through a durable outbox: `POST .../agents/{agentId}/jobs/report`, up to 20 jobs per call. The server records each document in the order's `completedDocumentIds`, and moves the order to `READY` once all of them are done. Cash is recorded at `READY`; pickup completion remains an explicit operator action.
   - **Outbox:** each finished local job is marked `report_state: pending` in SQLite in the same write as its final state, so a report survives an agent restart. The server's answer per job moves it to `acked` (`ok`), `rejected` (`lease_mismatch`, `invalid_state`, `not_found`) or back to pending with a backoff (`retry`, when the file couldn't be deleted yet). A failed call is retried with backoff, honouring `Retry-After`; a 400 rejects the batch.
   - **Stale reports:** a report whose lease no longer matches (the job was rescued or retried) gets `lease_mismatch` and changes nothing.
   - **Files:** after a document prints, the server deletes its stored file unless another active job uses it, and sets the document's `shreddedAt`. A shredded document can't be dispatched again (`409 DOCUMENT_SHREDDED`).
   - **Rescue:** an operator can retry a `FAILED` job, re-route a `QUEUED` one, or take back a job stuck in `DISPATCHING` for 15 minutes. Cloud jobs are retried in the cloud only, never by re-printing the local copy, so a job can't print twice. Retrying with another printer also moves the job to that printer's agent.
   - **Known gap:** **Mark ready for pickup** does not check that every document has a job, so an operator can finish an order early.

## Credentials and data handling

- The agent owns the shop login: it keeps the refresh token in Windows Credential Manager (`Ctrlp.PrintShop/refreshToken`), turns it into ID tokens, and hands them to the UI (`cloud.getIdToken`). There is no separate agent credential; agent routes take the shop's ID token and check its claims.
- Do not log document bytes, local document paths, signed URLs, or credentials.
- `CTRLP_PAYMENT_WEBHOOK_SECRET` is required by `POST /api/v1/internal/payments/shops/{shopId}/orders/{orderId}/confirmed`. Send it only as `x-ctrlp-payment-secret`; calls require a UUID idempotency key and a gateway payment reference.
- Download links last 60 minutes and stop working once the document is shredded. Stored files are deleted after printing, and the daily clean-up deletes the files of rejected and cancelled orders.

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
- The agent queue's persistence, claim, cancel, and retry behaviours, and the report columns of the SQLite store.
- The agent's sync service (coalescing, de-duplication by job and lease, staging failures, retry backoff) and the report outbox (batching, per-job results, `Retry-After`), on a fake clock and a fake HTTP handler.
- The server's pure job rules (`job-model.test.ts`: report decisions, retry and rescue) and board rules (`board-model.test.ts`). The physical Windows matrix above remains required because driver spool semantics cannot be reproduced in a cross-platform test.
