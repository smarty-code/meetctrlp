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
| Cold start makes the check slow. | With `minInstances: 0` the first request after a quiet period pays for a cold start. The web app's button shows **Checking documents…** at 99%, so the page doesn't look frozen. If cold starts hurt in practice, set `minInstances: 1` (an always-on, billed instance). |
| A large file runs the instance out of memory. That would fail every request on the instance, not only the upload. | `complete` reads the object's size first and rejects anything over 50 MB before downloading it. The download isn't copied a second time. `memoryMiB: 1024` leaves room for several large PDFs at once. |
| The instance drops the request, or returns 429/5xx while scaling. | The web app retries `complete` up to 3 times (after 1 s, then 2 s). This is safe because `complete` is idempotent. A 400 means the file itself is unusable and is not retried. |
| Storage is briefly unreachable. | `complete` returns 500 (retried) instead of 400. It returns 400 only when the object really doesn't exist. |

Every check downloads the whole file from Railway into Google Cloud, so the time it takes depends on the distance between them. Measure it after the first deploy.

## Desktops on serverless

No desktop holds a connection to the API ([traffic scaling v2](../../../docs/arc/traffic-scaling-v2/README.md)). The shop's agent waits on its doorbell, `/doorbell/{shopId}` in Realtime Database, over a REST stream that Google serves, not this backend. When the server changes a shop's orders or jobs it rings the doorbell, and the agent and the desktop make short requests:

- `POST /api/v1/shops/{shopId}/agents/{agentId}/sync` claims work; `.../jobs/report` reports results.
- `GET /api/v1/shops/{shopId}/board?since=…` fetches what changed on the board.

So an idle shop costs no API requests, the 5-minute request limit doesn't apply, and instances don't need to share memory: Firestore is the only state. A shop whose doorbell is unreachable falls back to calling `sync` every 60 seconds.

## What doesn't work on serverless

- **Local disk fallback:** `storeDocument` in [`document.service.ts`](../src/modules/documents/document.service.ts) writes to `data/print-jobs` when the `S3_*` variables are missing. On App Hosting that file disappears with the instance, so always set the `S3_*` variables.
- **Files in the request body:** `POST /api/v1/shops/{shopId}/orders/documents` takes files as multipart form data, so Cloud Run's 32 MiB request limit applies to it. Only the seed script (`scripts/seed-print-order.mjs`) uses this route.

## Run settings

[`apps/server/apphosting.yaml`](../apphosting.yaml):

| Setting | Value | Why |
| --- | --- | --- |
| `cpu` | 1 | Default. |
| `memoryMiB` | 1024 | `complete` holds a whole file (up to 50 MB) in memory. Raise to 2048 if Cloud Run logs show out-of-memory restarts. |
| `concurrency` | 80 | Default. Every request is short; nothing holds a slot open. |
| `minInstances` | 0 | Scales to zero, so a quiet backend costs nothing. The first request after a quiet period waits for a cold start. Set it to 1 to avoid that; **that bills an always-on instance.** |

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
| `FIREBASE_DATABASE_URL` | plain | Realtime Database URL for the shop doorbell, for example `https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app`. Without it the server skips rings and logs `ring_skipped` once. |
| `PRINT_USER_COOKIE_SECRET` | secret | Signs the guest cookie (`v1.<printUserId>.<shopId>.<exp>.<ipTag>.<hmac>`). At least 32 random characters. **Required in production:** without it every guest request fails with a server error. Changing it signs every guest out (they start a new cart). |
| `CTRLP_MAINTENANCE_SECRET` | secret | Shared secret for the daily clean-up route; see [Daily clean-up](#daily-clean-up). Unset: the route always returns 401. |
| `FIRESTORE_OP_COUNTERS` | plain | `1` logs one `request_ops` JSON line per API request: route, status, time, Firestore reads/writes/deletes, doorbell rings and ring failures. On in staging; leave unset in production unless investigating cost. |
| `ALLOW_MOCK_PAYMENTS` | plain | `1` enables the guest mock payment route. Local development and staging only. Unset in production: without it, any guest could mark an order paid. |

### Web app (`apps/printUserWebapp`)

| Variable | Kind | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | plain | The API backend's public URL. Next.js builds it into the app, so it's needed at build time and a change needs a new rollout. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | plain | Firebase web config for the tracking page's live listener (Firebase Console → Project settings → Your apps). Built into the app: make it available at **BUILD and RUNTIME**. Restrict the key in Google Cloud Console → Credentials to the web app's domain and to the Identity Toolkit, Token Service and Firestore APIs. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | plain | Same source. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | plain | Same source. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | plain | Same source. Without these four, the tracking page reads the order once and shows a Refresh button instead of listening. |

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

A `NEXT_PUBLIC_*` variable must be available at build time:

```yaml
env:
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: meetctrlp
    availability:
      - BUILD
      - RUNTIME
```

## Firebase rules and indexes

The rules and indexes live in `packages/firebase` and are listed in the root [`firebase.json`](../../../firebase.json). Deploy them before the code that needs them; a query without its index fails:

```bash
firebase deploy --only firestore:indexes,firestore:rules,database
```

- **Firestore rules:** guests may read only `orderTracking/{orderId}` where `printUserId` is their own uid; everything else is server-only.
- **Realtime Database rules:** a signed-in user whose token carries the claim `shopId` may read `/doorbell/{shopId}`; nobody writes from a client (the server writes with Admin credentials).
- **Indexes:** wait until the console shows them as built (a few minutes on an empty project, longer with data) before rolling out.

## Daily clean-up

`POST /api/v1/internal/maintenance/daily` removes tracking copies of orders finished more than 30 days ago, expired guest sessions (their cart files and Firebase Auth users), and the files of rejected or cancelled orders. Each run is bounded, so it's safe to run more often than daily. Schedule it once per project with Cloud Scheduler:

```bash
gcloud scheduler jobs create http ctrlp-daily-maintenance --location=<region> --schedule="30 3 * * *" --time-zone="Asia/Kolkata" --http-method=POST --uri="https://<api-backend-url>/api/v1/internal/maintenance/daily" --headers="x-ctrlp-maintenance-secret=<CTRLP_MAINTENANCE_SECRET>" --attempt-deadline=300s
```

Put the secret in the command from your shell (for example `$(gcloud secrets versions access latest --secret=CTRLP_MAINTENANCE_SECRET)`), not in a file. The response lists what each step removed; a 401 means the header and `CTRLP_MAINTENANCE_SECRET` differ.

## Cost alerts

Set these up once per project (implementation plan 12.3). The thresholds keep a day's usage inside the free tier.

**Budget:** Cloud Billing → Budgets & alerts → a monthly budget of about $5 with alerts at 50%, 90% and 100%.

**Log-based metrics** for doorbell rings. The server logs `ring_failed` when a ring never reached the database and `ring_unknown` when it timed out but may have landed:

```bash
gcloud logging metrics create ring_failed --description="Doorbell rings that did not reach Realtime Database" --log-filter='jsonPayload.message="ring_failed"'
gcloud logging metrics create ring_unknown --description="Doorbell rings that timed out" --log-filter='jsonPayload.message="ring_unknown"'
```

Then, in Cloud Monitoring → Alerting, create policies on:

| Metric | Alert when |
| --- | --- |
| `logging.googleapis.com/user/ring_failed` | more than 10 in an hour |
| Firestore document reads | more than 40,000 a day |
| Firestore document writes | more than 16,000 a day |
| Cloud Run request count (both backends) | more than 50,000 a day |
| Realtime Database bytes sent | on pace for more than 7 GB a month |

## Not verified yet

These need checking on a deployed backend:

- **IP binding:** guest sessions are tied to the client IP, using the first `X-Forwarded-For` entry. The web app proxy forwards the visitor's header, so the first entry should be the visitor's IP, not the web app's outgoing IP. Confirm this, because an IP change returns 401 on every cart call.
- **Cold starts:** with `minInstances: 0`, measure the first `complete` and the first desktop `board` fetch after an idle hour.
- **Idle cost:** a shop PC open for an hour with no orders makes 0 API requests and 0 Firestore reads, and its doorbell sends about 10 KB or less (implementation plan 12.2).
- **Guest sign-in billing:** if the project uses Identity Platform rather than legacy Firebase Auth, each guest who opens the tracking page counts as a monthly active user (implementation plan 5.4, "Cost check before P3-01").
- **Check time:** measure how long `complete` takes for a 50 MB PDF between Railway and the backend's region.
- **Build:** confirm the pnpm workspace packages (`@ctrlp/firebase`, `@ctrlp/schemas`, `@ctrlp/ui`) build from each backend's root directory.
