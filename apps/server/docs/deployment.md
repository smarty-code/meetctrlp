# Deploying to Firebase App Hosting

`apps/server` (the API) and `apps/printUserWebapp` (the customer site) each run as their own Firebase App Hosting backend in the `meetctrlp` project. The shop desktop is an installer built on a Windows PC and pointed at the API. Every environment variable, with copy-paste blocks for each app, is in [`docs/deploy/ENVIRONMENT.md`](../../../docs/deploy/ENVIRONMENT.md).

Part 1 is the step-by-step first deploy. Part 2 explains how the backends behave on serverless hosting. Part 3 is the test pass after a deploy.

| Backend | ID (suggested) | Root directory | Config |
| --- | --- | --- | --- |
| API | `ctrlp-api` | `apps/server` | [`apps/server/apphosting.yaml`](../apphosting.yaml) |
| Customer web app | `ctrlp-web` | `apps/printUserWebapp` | [`apps/printUserWebapp/apphosting.yaml`](../../printUserWebapp/apphosting.yaml) |

App Hosting reads `apphosting.yaml` from the backend's root directory. Each backend gets a URL of the form `https://<backend-id>--<project-id>.<region>.hosted.app`, for example `https://ctrlp-api--meetctrlp.asia-southeast1.hosted.app`.

---

# Part 1: First deploy, step by step

Run the commands from the repo root in PowerShell or Git Bash. The Firebase CLI is a dev dependency of the repo, so it's called as `pnpm exec firebase`.

## Step 0. Before anything else: rotate the leaked credentials

`apps/server/.env` and `apps/server/.env.local` are tracked in git and contain the Firebase service-account private key and the S3 secret key. Anyone with the repository has them. Do this **before** the first deploy, because the deployed backend will use whatever key you give it:

1. **Firebase service account:** Google Cloud Console → IAM & Admin → Service Accounts → the `firebase-adminsdk-…` account → Keys. Create a new JSON key, then delete the old key (the one whose ID matches `private_key_id` in the leaked value).
2. **Railway S3 key:** in Railway, create a new access key for the bucket and delete the old one.
3. **Untrack the files** (they stay on your disk):

   ```bash
   git rm --cached apps/server/.env apps/server/.env.local
   ```

   `apps/server/.gitignore` already lists both, so once untracked they stay out of git. Commit the removal. The old values remain in git history; rotation is what makes them useless.

4. Put the new values in your local `apps/server/.env.local` (template in the env sheet) and in App Hosting secrets (step 5).

## Step 1. Tools and sign-in

| Need | Check |
| --- | --- |
| Blaze (pay-as-you-go) plan on `meetctrlp` | Firebase console → Usage and billing. App Hosting requires it. |
| Node 22 and pnpm 11 | `node -v`, `pnpm -v` |
| JDK 21+ (only for the emulator and rules tests) | `java -version` |
| Firebase CLI signed in | `pnpm exec firebase login`, then `pnpm exec firebase projects:list` shows `meetctrlp` |
| The code on GitHub | App Hosting builds from the GitHub repo `smarty-code/meetctrlp`. Push the branch you'll deploy. |
| Optional: Google Cloud CLI (`gcloud`) | Only for the Cloud Scheduler and log-metric commands; the console does the same. |

## Step 2. Run the tests locally

```bash
pnpm --filter server test
```

```bash
pnpm --filter server test:emulator
```

```bash
pnpm firebase:rules:test
```

All three must pass (52, 38 and 11 tests). The full list is in the [testing guide](../../../docs/arc/traffic-scaling-v2/TESTING_GUIDE.md), section 2.

## Step 3. Turn on the Firebase services

In the Firebase console for `meetctrlp`:

1. **Authentication → Sign-in method:** enable **Email/Password**. (Shop logins use it; guests use custom tokens, which need no provider.) Under **Settings**, check whether the project was upgraded to Identity Platform; if it was, each guest who opens the tracking page counts as a monthly active user.
2. **Firestore:** the database exists (Native mode).
3. **Realtime Database:** the instance `meetctrlp-default-rtdb` (asia-southeast1) exists.
4. **Project settings → Your apps:** make sure there is a **Web app**. Its config (`apiKey`, `authDomain`, `projectId`, `appId`) goes into the web app's env and the desktop's env.

## Step 4. Deploy the security rules and indexes

```bash
pnpm exec firebase deploy --only firestore:indexes,firestore:rules,database --project meetctrlp
```

- **Firestore rules:** guests may read only `orderTracking/{orderId}` where `printUserId` is their own uid; everything else is server-only.
- **Realtime Database rules:** a signed-in user whose token carries the claim `shopId` may read `/doorbell/{shopId}`; nobody writes from a client (the server writes with Admin credentials).
- **Indexes:** wait until Firestore → Indexes shows every index as **Enabled** before the first rollout. A query without its index fails with `FAILED_PRECONDITION`.

The CLI may say an index in the console isn't in the file and offer to delete it. Answer **No** unless you know it's unused.

## Step 5. Create the secrets

Create each secret once. The command asks for the value with hidden input, so it never lands in your shell history or a file:

```bash
pnpm exec firebase apphosting:secrets:set FIREBASE_SERVICE_ACCOUNT_BASE64 --project meetctrlp
```

Repeat for every secret in the env sheet's [secrets list](../../../docs/deploy/ENVIRONMENT.md#api-secrets): `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_WEB_API_KEY`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `PRINT_USER_COOKIE_SECRET`, `CTRLP_MAINTENANCE_SECRET`, `CTRLP_PAYMENT_WEBHOOK_SECRET`, `PRINTER_INVENTORY_API_KEY`. The sheet shows how to produce each value.

If the backend doesn't exist yet, the command can't grant it access. After step 6, grant each secret:

```bash
pnpm exec firebase apphosting:secrets:grantaccess FIREBASE_SERVICE_ACCOUNT_BASE64 --backend ctrlp-api --project meetctrlp
```

A reference in `apphosting.yaml` to a secret that doesn't exist, or that the backend can't read, fails the rollout with a clear error in the build log.

## Step 6. Create the two backends

```bash
pnpm exec firebase apphosting:backends:create --project meetctrlp
```

Answer the prompts:

| Prompt | API | Web app |
| --- | --- | --- |
| Region | The one nearest India that the CLI offers (`asia-southeast1` if listed, next to the Realtime Database). Use the same region for both. | same |
| GitHub connection and repository | `smarty-code/meetctrlp` | same |
| Root directory | `apps/server` | `apps/printUserWebapp` |
| Live branch | The branch you deploy (`fix/upload` today; `main` once merged) | same |
| Automatic rollouts | Yes: every push to the live branch deploys | same |
| Backend ID | `ctrlp-api` | `ctrlp-web` |

The CLI prints each backend's URL. Write both down; the env needs them:

- API URL → the web app's `NEXT_PUBLIC_API_BASE_URL` and the desktop's `VITE_SERVER_BASE_URL`.
- Web app URL → the API's `PRINT_USER_ORIGIN` (QR codes, customer links, CORS).

The first rollouts start right away and fail or misbehave until the env is in place. That's expected.

## Step 7. Put the env in `apphosting.yaml` and push

1. Copy the API block from the env sheet into [`apps/server/apphosting.yaml`](../apphosting.yaml) (it replaces the whole file: run settings plus `env`). Fill in the `<…>` values: the two URLs, the S3 endpoint and bucket.
2. Copy the web app block into [`apps/printUserWebapp/apphosting.yaml`](../../printUserWebapp/apphosting.yaml). Fill in the API URL and the Firebase web config.
3. Commit and push to the live branch. Each backend rolls out on its own (watch Firebase console → App Hosting → the backend → Rollouts).

The `apphosting.yaml` files hold only plain values and secret **names**, so they're safe to commit.

To roll out again without a push: App Hosting → the backend → **Create rollout**, or:

```bash
pnpm exec firebase apphosting:rollouts:create ctrlp-api --git-branch fix/upload --project meetctrlp
```

### If the build fails

The build log is under App Hosting → backend → Rollouts → the rollout → **View logs**.

| Symptom in the log | Cause and fix |
| --- | --- |
| `Cannot find module '@ctrlp/…'` or `workspace:*` can't be resolved | The workspace wasn't installed from the repo root. The repo has `turbo.json`, `pnpm-workspace.yaml` and `pnpm-lock.yaml` at the root, which App Hosting's monorepo support expects; check the root directory is exactly `apps/server` (or `apps/printUserWebapp`). |
| `ERR_PNPM_…` about the pnpm version, or the lockfile is "not up to date" | The build installs with a frozen lockfile. Run `pnpm install` locally, commit `pnpm-lock.yaml`, push. The root `package.json` pins `packageManager: pnpm@11.27.0`. |
| `secret … not found` / permission denied on a secret | Step 5: create it, or grant the backend access. |
| `Missing required environment variable …` at runtime | A variable is missing from `apphosting.yaml`, or it's a `NEXT_PUBLIC_*` value without `BUILD` availability. |
| The web app builds but calls `localhost:3000` | `NEXT_PUBLIC_API_BASE_URL` wasn't available at build time. It's built into the app; fix the env and roll out again. |

## Step 8. Storage CORS for browser uploads

The customer's browser `PUT`s each file straight to the Railway bucket with a presigned URL, so the bucket must allow the web app's origin. In Railway's bucket settings (or with any S3 tool against the bucket), set a CORS rule like:

```json
[
  {
    "AllowedOrigins": ["https://ctrlp-web--meetctrlp.<region>.hosted.app", "http://localhost:3002"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add any custom domain you put on the web app. Without this rule uploads fail in the browser with a CORS error, while the server looks healthy.

## Step 9. Schedule the daily clean-up

`POST /api/v1/internal/maintenance/daily` removes tracking copies of orders finished more than 30 days ago, expired guest sessions (their cart files and Firebase Auth users), and the files of rejected or cancelled orders. Each run is bounded, so it's safe to run more often than daily.

**Console:** Cloud Scheduler → Create job:

| Field | Value |
| --- | --- |
| Name | `ctrlp-daily-maintenance` |
| Region | the backends' region |
| Frequency | `30 3 * * *`, time zone Asia/Kolkata |
| Target | HTTP, `POST`, URL `https://<api-url>/api/v1/internal/maintenance/daily` |
| Headers | `x-ctrlp-maintenance-secret: <the CTRLP_MAINTENANCE_SECRET value>` |
| Attempt deadline | 300 s |

**Or with gcloud** (reads the secret from Secret Manager, so it isn't typed or saved):

```bash
gcloud scheduler jobs create http ctrlp-daily-maintenance --project=meetctrlp --location=<region> --schedule="30 3 * * *" --time-zone="Asia/Kolkata" --http-method=POST --uri="https://<api-url>/api/v1/internal/maintenance/daily" --headers="x-ctrlp-maintenance-secret=$(gcloud secrets versions access latest --secret=CTRLP_MAINTENANCE_SECRET --project=meetctrlp)" --attempt-deadline=300s
```

Press **Force run** once. The job shows "Success", and the response lists what each step removed. A 401 means the header and `CTRLP_MAINTENANCE_SECRET` differ.

## Step 10. Restrict the API keys

Google Cloud Console → APIs & Services → Credentials:

- **The web app's key** (`NEXT_PUBLIC_FIREBASE_API_KEY`): Application restrictions → Websites → the web app's URL (and custom domain). API restrictions → Identity Toolkit API, Token Service API, Cloud Firestore API.
- **The desktop's key** (`VITE_FIREBASE_API_KEY`, used by the agent): API restrictions → Token Service API and Firebase Realtime Database API. It can't have a website restriction (it's called from a Windows process), so keep it to those APIs.
- **The server's key** (`FIREBASE_WEB_API_KEY`): Identity Toolkit API and Token Service API.

Using one key for all three is allowed but gives up these limits. Firebase Auth's own key checks are separate from these restrictions.

## Step 11. Alerts

Set these up once per project (implementation plan 12.3). The thresholds keep a day's usage inside the free tier.

**Budget:** Cloud Billing → Budgets & alerts → a monthly budget of about $5 with alerts at 50%, 90% and 100%.

**Log-based metrics** for doorbell rings. The server logs `ring_failed` when a ring never reached the database and `ring_unknown` when it timed out but may have landed:

```bash
gcloud logging metrics create ring_failed --project=meetctrlp --description="Doorbell rings that did not reach Realtime Database" --log-filter='jsonPayload.message="ring_failed"'
```

```bash
gcloud logging metrics create ring_unknown --project=meetctrlp --description="Doorbell rings that timed out" --log-filter='jsonPayload.message="ring_unknown"'
```

Then, in Cloud Monitoring → Alerting, create policies on:

| Metric | Alert when |
| --- | --- |
| `logging.googleapis.com/user/ring_failed` | more than 10 in an hour |
| Firestore document reads | more than 40,000 a day |
| Firestore document writes | more than 16,000 a day |
| Cloud Run request count (both backends) | more than 50,000 a day |
| Realtime Database bytes sent | on pace for more than 7 GB a month |

## Step 12. Build the shop desktop installer

On a Windows PC with the desktop toolchain (`pnpm desktop:setup`):

1. Create `apps/print-shop/.env.production` from the env sheet's desktop block, with the **API URL** as `VITE_SERVER_BASE_URL`. Vite builds these values into the app.
2. Build:

   ```bash
   pnpm desktop:build
   ```

3. The installer is in `apps/print-shop/src-tauri/target/release/bundle/nsis/`. Install it on the shop PC and log in.

The API already allows the Tauri app's origins (`tauri://localhost`, `https://tauri.localhost`); `DESKTOP_ORIGIN` is only for anything else.

## Updating later

- **Code:** push to the live branch; both backends roll out. A rollout that fails leaves the previous one serving.
- **Rules or indexes changed:** run `pnpm firebase:rules:test`, then step 4, **before** pushing the code that needs them.
- **A secret's value:** `pnpm exec firebase apphosting:secrets:set NAME --project meetctrlp` adds a new version; roll out again to pick it up. Changing `PRINT_USER_COOKIE_SECRET` signs every guest out.
- **Roll back:** App Hosting → backend → Rollouts → an earlier rollout → **Roll back** (builds are kept for 14 days, and the last 5 always).
- **Desktop:** rebuild the installer and reinstall; the agent updates with it.

---

# Part 2: How the backends behave on serverless

App Hosting runs each backend on Cloud Run:

- Containers start when traffic arrives and stop when it's quiet. The first request after a quiet period waits for a cold start, unless `minInstances` keeps one running.
- Each instance has a fixed amount of memory and serves many requests at once (`concurrency`).
- A request is ended after **5 minutes**. `apphosting.yaml` has no setting to change this.
- The local disk belongs to one instance and is erased when the instance stops.

The web app calls the API through its own `/api` proxy ([`src/app/api/[...path]/route.ts`](../../printUserWebapp/src/app/api/[...path]/route.ts)), so the browser only talks to the web app's domain and the guest cookie is first-party. The proxy forwards the visitor's `X-Forwarded-For`, which the API uses to tie the guest cookie to the visitor's network.

## Run settings

[`apps/server/apphosting.yaml`](../apphosting.yaml):

| Setting | Value | Why |
| --- | --- | --- |
| `cpu` | 1 | Default. |
| `memoryMiB` | 1024 | `complete` holds a whole file (up to 50 MB) in memory. Raise to 2048 if Cloud Run logs show out-of-memory restarts. |
| `concurrency` | 80 | Default. Every request is short; nothing holds a slot open. |
| `minInstances` | 0 | Scales to zero, so a quiet backend costs nothing. The first request after a quiet period waits for a cold start. Set it to 1 to avoid that; **that bills an always-on instance.** |

The web app uses `minInstances: 0` and the default memory.

## Uploads

File bytes never pass through either backend. The browser `PUT`s each file straight to Railway storage with a presigned URL, so Cloud Run's 32 MiB request size limit doesn't apply. Two server calls happen per file (see [`print-user.md`](./print-user.md#uploading-one-file)):

1. `POST .../documents` creates the intent and presigned URL. It's a small JSON request.
2. `POST .../documents/{docId}/complete` downloads the file from Railway, checks it, counts pages, and hashes it. This is the only step that serverless hosting affects:

| Risk on serverless | What handles it |
| --- | --- |
| Cold start makes the check slow. | The web app's button shows **Checking documents…** at 99%, so the page doesn't look frozen. If cold starts hurt in practice, set `minInstances: 1`. |
| A large file runs the instance out of memory. That would fail every request on the instance, not only the upload. | `complete` reads the object's size first and rejects anything over 50 MB before downloading it. `memoryMiB: 1024` leaves room for several large PDFs at once. |
| The instance drops the request, or returns 429/5xx while scaling. | The web app retries `complete` up to 3 times (after 1 s, then 2 s). `complete` is idempotent. A 400 means the file itself is unusable and is not retried. |
| Storage is briefly unreachable. | `complete` returns 500 (retried) instead of 400. It returns 400 only when the object really doesn't exist. |

Every check downloads the whole file from Railway into Google Cloud, so its time depends on the distance between them.

## Desktops

No desktop holds a connection to the API ([traffic scaling v2](../../../docs/arc/traffic-scaling-v2/README.md)). The shop's agent waits on its doorbell, `/doorbell/{shopId}` in Realtime Database, over a REST stream that Google serves, not this backend. When the server changes a shop's orders or jobs it rings the doorbell, and the agent and the desktop make short requests:

- `POST /api/v1/shops/{shopId}/agents/{agentId}/sync` claims work; `.../jobs/report` reports results.
- `GET /api/v1/shops/{shopId}/board?since=…` fetches what changed on the board.

So an idle shop costs no API requests, the 5-minute request limit doesn't apply, and instances don't need to share memory: Firestore is the only state. A shop whose doorbell stream keeps breaking polls the doorbell (not the API) every 60 seconds.

## What doesn't work on serverless

- **Local disk fallback:** `storeDocument` in [`document.service.ts`](../src/modules/documents/document.service.ts) writes to `data/print-jobs` when the `S3_*` variables are missing. On App Hosting that file disappears with the instance, so always set the `S3_*` variables.
- **Files in the request body:** `POST /api/v1/shops/{shopId}/orders/documents` takes files as multipart form data, so Cloud Run's 32 MiB request limit applies to it. Only the seed script (`scripts/seed-print-order.mjs`) uses this route.

---

# Part 3: Test after each deploy

Set `$API` and `$WEB` to the two backend URLs.

## Smoke checks (5 minutes)

| Check | Pass |
| --- | --- |
| `curl -s $API/api/v1/public/shops/<a-shop-slug>` | `200` with `{ "shop": … }` |
| `curl -s -X POST $API/api/v1/internal/maintenance/daily` | `401` (the route is up and guarded) |
| Open `$WEB/s/<a-shop-slug>` in a phone browser | The shop page loads and shows opening hours |
| Upload a PDF and an image | Both reach **Ready**; no CORS error in the browser console (step 8) |
| Place a cash order | The tracking page shows "Order received" |
| On the desktop (installed from step 12), log in | The order appears; Settings shows the doorbell **connected** |
| Accept and print it | The tracking page moves to Printing, then Ready, with no Refresh |

## Full pass

Run the manual cases in the [testing guide](../../../docs/arc/traffic-scaling-v2/TESTING_GUIDE.md):

1. Sections 3–7 (server: auth, payments, orders and jobs, rings, guest cookie) against `$API`.
2. Sections 8–10 on a shop PC with the installer: connection, sync and printing, the board.
3. Section 11 on a phone and a desktop browser against `$WEB`.
4. Section 12: the idle and cost checks (turn on `FIRESTORE_OP_COUNTERS` for that run), the maintenance job, and cold starts.

Record results in the sheet in section 15.

## Still to confirm on the first deploy

- **IP binding:** the guest cookie carries a hash of the client IP, taken from the first `X-Forwarded-For` entry. Confirm the API sees the visitor's IP, not the web app's outgoing IP: two phones on different networks must get different carts, and one phone's cart must keep working across pages. If every guest gets 401 on cart calls, the IP isn't stable.
- **Build from a subdirectory:** the first rollout proves the pnpm workspace packages (`@ctrlp/firebase`, `@ctrlp/schemas`, `@ctrlp/types`, `@ctrlp/ui`) build from each backend's root directory.
- **Cold starts:** measure the first `complete` and the first desktop board fetch after an idle hour.
- **Guest sign-in billing:** see step 3.
