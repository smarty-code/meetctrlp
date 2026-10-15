# Deploying to Firebase App Hosting

`apps/server` (the API) and `apps/printUserWebapp` (the customer site) each run as their own Firebase App Hosting backend. App Hosting runs a backend on Cloud Run:

- Containers start when traffic arrives and stop when it's quiet. The first request after a quiet period waits for a cold start, unless `minInstances` keeps one running.
- Each instance has a fixed amount of memory and serves many requests at once (`concurrency`).
- A request is ended after **5 minutes**. `apphosting.yaml` has no setting to change this.
- The local disk belongs to one instance and is erased when the instance stops.

## Backends

| Backend | Root directory | Run settings |
| --- | --- | --- |
| API | `apps/server` | [`apps/server/apphosting.yaml`](../apphosting.yaml) |
| Customer web app | `apps/printUserWebapp` | defaults |

The web app calls the API through its own `/api` proxy ([`src/app/api/[...path]/route.ts`](../../printUserWebapp/src/app/api/[...path]/route.ts)), so the browser only talks to the web app's domain and the guest cookie is first-party.

## Uploads on serverless

File bytes never pass through either backend. The browser `PUT`s each file straight to Railway storage with a presigned URL, so the upload button's progress comes from the browser's own `PUT`. Cloud Run's 32 MiB request size limit doesn't apply to these uploads.

Two server calls happen per file (see [`print-user.md`](./print-user.md#uploading-one-file)):

1. `POST .../documents` creates the intent and presigned URL. It's a small JSON request.
2. `POST .../documents/{docId}/complete` downloads the file from Railway, checks it, counts pages, and hashes it. This is the only step that serverless hosting affects:

| Risk on serverless | What handles it |
| --- | --- |
| Cold start makes the check slow. | `minInstances: 1` keeps one instance warm. Meanwhile the web app's button shows **Checking documents…** at 99%, so the page doesn't look frozen. |
| A large file runs the instance out of memory. That would fail every request on the instance, not only the upload. | `complete` reads the object's size first and rejects anything over 50 MB before downloading it. The download isn't copied a second time. `memoryMiB: 1024` leaves room for several large PDFs at once. |
| The instance drops the request, or returns 429/5xx while scaling. | The web app retries `complete` up to 3 times (after 1 s, then 2 s). This is safe because `complete` is idempotent. A 400 means the file itself is unusable and is not retried. |
| Storage is briefly unreachable. | `complete` returns 500 (retried) instead of 400. It returns 400 only when the object really doesn't exist. |

Every check downloads the whole file from Railway into Google Cloud, so the time it takes depends on the distance between them. Measure it after the first deploy.

## Desktop order stream on serverless

`GET /api/v1/shops/{shopId}/orders/stream` is a long-lived SSE response. On App Hosting:

- **It's cut after 5 minutes.** The desktop app reconnects with backoff (0.5 s, doubling up to 10 s, in [`apps/print-shop/src/lib/cloud.ts`](../../print-shop/src/lib/cloud.ts)), so orders keep arriving.
- **Reconnects cost reads.** Each reconnect sends a fresh `ORDERS_SNAPSHOT`, and today that re-reads the shop's order history (section 4.1 of the [traffic plan](../../../docs/arc/DESKTOP_TRAFFIC_SCALING_PLAN.md)). That's at least 12 snapshots an hour for each open desktop. The shop hub in section 7.4 of that plan removes most of this cost.
- **Each open stream uses capacity.** It holds one `concurrency` slot and keeps its instance running and billed.
- **Instances don't share memory.** The planned in-memory hub still works: each instance builds its own hub from Firestore, and Firestore stays the source of truth.

## What doesn't work on serverless

- **Local disk fallback:** `storeDocument` in [`document.service.ts`](../src/modules/documents/document.service.ts) writes to `data/print-jobs` when the `S3_*` variables are missing. On App Hosting that file disappears with the instance, so always set the `S3_*` variables.
- **Files in the request body:** `POST /api/v1/shops/{shopId}/orders/documents` takes files as multipart form data, so Cloud Run's 32 MiB request limit applies to it. Only the seed script (`scripts/seed-print-order.mjs`) uses this route.

## Run settings

[`apps/server/apphosting.yaml`](../apphosting.yaml):

| Setting | Value | Why |
| --- | --- | --- |
| `cpu` | 1 | Default. |
| `memoryMiB` | 1024 | `complete` holds a whole file (up to 50 MB) in memory. Raise to 2048 if Cloud Run logs show out-of-memory restarts. |
| `concurrency` | 80 | Default. Desktop streams hold slots for up to 5 minutes each. |
| `minInstances` | 1 | Avoids cold starts on the first upload and on desktop reconnects. **This bills an always-on instance.** Set it to 0 to scale to zero. |

## Environment variables

### API (`apps/server`)

| Variable | Kind | Notes |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | secret | Firebase Admin credentials. The code doesn't use the backend's default credentials. |
| `FIREBASE_WEB_API_KEY` | secret | Password sign-in. Also signs local download links. |
| `S3_ENDPOINT` | plain | Railway endpoint |
| `S3_BUCKET_NAME` | plain | |
| `S3_REGION` | plain | `auto` |
| `S3_ACCESS_KEY_ID` | secret | |
| `S3_SECRET_ACCESS_KEY` | secret | |
| `PRINT_USER_ORIGIN` | plain | The web app backend's public URL. Used for shop QR codes and customer links. |
| `DESKTOP_ORIGIN` | plain | Optional extra CORS origin |
| `PRINTER_INVENTORY_API_KEY` | secret | Desktop agent printer inventory |
| `CTRLP_PAYMENT_WEBHOOK_SECRET` | secret | Payment confirmation webhook |

### Web app (`apps/printUserWebapp`)

| Variable | Kind | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | plain | The API backend's public URL. Next.js builds it into the app, so it's needed at build time and a change needs a new rollout. |

### Adding them

Create each secret in Cloud Secret Manager. The command offers to give the backend access:

```bash
firebase apphosting:secrets:set S3_SECRET_ACCESS_KEY
```

Then reference it from the backend's `apphosting.yaml`, or set it in the Firebase console:

```yaml
env:
  - variable: S3_SECRET_ACCESS_KEY
    secret: S3_SECRET_ACCESS_KEY
  - variable: S3_REGION
    value: auto
```

`apphosting.yaml` only lists run settings for now. Add the `env` entries once the secrets exist; a reference to a missing secret fails the rollout.

## Not verified yet

These need checking on a deployed backend:

- **IP binding:** guest sessions are tied to the client IP, using the first `X-Forwarded-For` entry. The web app proxy forwards the visitor's header, so the first entry should be the visitor's IP, not the web app's outgoing IP. Confirm this, because an IP change returns 401 on every cart call.
- **Streaming:** confirm the SSE stream is delivered as it's written, not buffered until the 5-minute cut.
- **Check time:** measure how long `complete` takes for a 50 MB PDF between Railway and the backend's region.
- **Build:** confirm the pnpm workspace packages (`@ctrlp/firebase`, `@ctrlp/schemas`, `@ctrlp/ui`) build from each backend's root directory.
