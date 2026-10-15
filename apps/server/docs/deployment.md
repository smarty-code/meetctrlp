# Deploying CtrlP

Where each part runs:

| Part | Host | Project / ID | Root directory | Config in the repo |
| --- | --- | --- | --- | --- |
| API (`apps/server`) | **Vercel** | Vercel project `ctrlp-api` | `apps/server` | [`apps/server/vercel.json`](../vercel.json) (the daily cron) |
| Customer web app (`apps/printUserWebapp`) | **Firebase App Hosting** | backend `ctrlp-web` in `meetctrlp` | `apps/printUserWebapp` | [`apps/printUserWebapp/apphosting.yaml`](../../printUserWebapp/apphosting.yaml) |
| Database, auth, doorbell, rules | **Firebase** | project `meetctrlp` | — | [`firebase.json`](../../../firebase.json), `packages/firebase/*.rules*`, `firestore.indexes.json` |
| File storage | **Railway** (S3-compatible) | the existing bucket | — | — |
| Shop desktop | Installer on each shop PC | — | `apps/print-shop` | `apps/print-shop/.env.production` |

Every environment variable, as copy-paste blocks for each part, is in [`docs/deploy/ENVIRONMENT.md`](../../../docs/deploy/ENVIRONMENT.md).

Part 1 is the step-by-step first deploy. Part 2 explains how the API behaves on Vercel. Part 3 is the test pass after a deploy.

---

# Part 1: First deploy, step by step

Run the commands from the repo root. The Firebase CLI is a dev dependency of the repo, so it's called as `pnpm exec firebase`. The Vercel steps use the Vercel dashboard; the Vercel CLI (`pnpm dlx vercel`) can do the same.

## Step 0. Before anything else: rotate the leaked credentials

`apps/server/.env` and `apps/server/.env.local` are tracked in git and contain the Firebase service-account private key and the S3 secret key. Anyone with the repository has them. Do this **before** the first deploy, because the deployed API will use whatever key you give it:

1. **Firebase service account:** Google Cloud Console → IAM & Admin → Service Accounts → the `firebase-adminsdk-…` account → Keys. Create a new JSON key, then delete the old key (the one whose ID matches `private_key_id` in the leaked value).
2. **Railway S3 key:** in Railway, create a new access key for the bucket and delete the old one.
3. Update committed env files under `apps/server/` (if you track them), your local copies, and Vercel (step 5) with the new credentials. Old values remain in git history until you rotate; rotation is what makes leaked keys useless.

4. Put the new values in `apps/server/.env.local` (template in the env sheet, section 1.1) and in Vercel (step 5).

## Step 1. Accounts and tools

| Need | Check |
| --- | --- |
| Vercel account connected to GitHub | vercel.com → Add New → Project lists `smarty-code/meetctrlp`. Hobby works; its cron runs once a day at a time inside the chosen hour, which is enough here. |
| Blaze (pay-as-you-go) plan on `meetctrlp` | Firebase console → Usage and billing. App Hosting (the web app) requires it. |
| Node 22 and pnpm 11 | `node -v`, `pnpm -v` |
| JDK 21+ (only for the emulator and rules tests) | `java -version` |
| Firebase CLI signed in | `pnpm exec firebase login`, then `pnpm exec firebase projects:list` shows `meetctrlp` |
| The code on GitHub | Both Vercel and App Hosting build from `smarty-code/meetctrlp`. Push the branch you deploy. |

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

All three must pass (53, 38 and 11 tests). The full list is in the [testing guide](../../../docs/arc/traffic-scaling-v2/TESTING_GUIDE.md), section 2.

## Step 3. Turn on the Firebase services

In the Firebase console for `meetctrlp`:

1. **Authentication → Sign-in method:** enable **Email/Password**. (Shop logins use it; guests use custom tokens, which need no provider.) Under **Settings**, check whether the project was upgraded to Identity Platform; if it was, each guest who opens the tracking page counts as a monthly active user.
2. **Firestore:** the database exists (Native mode). Note its **location** (Firestore → Settings); step 5 puts the API next to it.
3. **Realtime Database:** the instance `meetctrlp-default-rtdb` (asia-southeast1) exists.
4. **Project settings → Your apps:** make sure there is a **Web app**. Its config (`apiKey`, `authDomain`, `projectId`, `appId`) goes into the web app's env and the desktop's env.

## Step 4. Deploy the security rules and indexes

```bash
pnpm exec firebase deploy --only firestore:indexes,firestore:rules,database --project meetctrlp
```

- **Firestore rules:** guests may read only `orderTracking/{orderId}` where `printUserId` is their own uid; everything else is server-only.
- **Realtime Database rules:** a signed-in user whose token carries the claim `shopId` may read `/doorbell/{shopId}`; nobody writes from a client (the server writes with Admin credentials).
- **Indexes:** wait until Firestore → Indexes shows every index as **Enabled** before the API's first deploy. A query without its index fails with `FAILED_PRECONDITION`.

The CLI may say an index in the console isn't in the file and offer to delete it. Answer **No** unless you know it's unused.

## Step 5. Deploy the API to Vercel

### 5.1 Create the project

Vercel dashboard → **Add New → Project** → import `smarty-code/meetctrlp`:

| Setting | Value |
| --- | --- |
| Project name | `ctrlp-api` (the URL becomes `https://ctrlp-api.vercel.app`, or with a suffix if taken) |
| Framework preset | Next.js (detected) |
| Root Directory | `apps/server` |
| Build and install commands | Leave the defaults. Vercel installs the pnpm workspace and builds with `next build`, which compiles the `@ctrlp/*` packages from source (`transpilePackages`). |

Don't press Deploy yet: add the environment first.

### 5.2 Environment variables

In the import screen's **Environment Variables** section (or later in Settings → Environment Variables):

1. Open the env sheet, [section 1.2](../../../docs/deploy/ENVIRONMENT.md#12-vercel-production-environment), and copy the whole block.
2. Paste it into the **Key** field. Vercel splits a pasted `.env` block into one variable per line.
3. Fill in each value. For `PRINT_USER_ORIGIN`, use the web app's URL if you know it; otherwise put a placeholder and fix it in step 7.
4. Scope them to **Production** (and Preview if you'll use preview deployments). Mark the secrets **Sensitive**, so nobody can read them back from the dashboard.

`ENABLE_EXPERIMENTAL_COREPACK=1` in that block matters: the repo pins pnpm 11 in the root `package.json` (`packageManager`), and Vercel's built-in pnpm stops at 10. With Corepack on, the build uses the pinned version.

### 5.3 Region and function settings

Settings → **Functions**:

| Setting | Value | Why |
| --- | --- | --- |
| Function region | The Vercel region next to Firestore's location: `bom1` (Mumbai) for `asia-south1`, `sin1` (Singapore) for `asia-southeast1` | Every request does several Firestore round trips, so this is the biggest latency win. |
| Fluid compute | On (the default for new projects) | One instance serves overlapping requests, like Cloud Run. |
| Max duration | Leave the default (300 s) | `complete` on a 50 MB PDF and the daily clean-up fit in it. The maintenance route also sets `maxDuration = 300`. |

### 5.4 Deploy

Press **Deploy**. When it's done, note the production URL, for example `https://ctrlp-api.vercel.app`. That's `<api-url>` everywhere else.

Every push to the **Production Branch** (Settings → Git; set it to `fix/upload` for now, `main` once merged) deploys again. Other branches get preview URLs.

**Deployment Protection:** Vercel protects preview URLs with Vercel login by default. The production URL stays public, which the desktop and the web app need. Don't point either at a preview URL.

### If the build fails

The log is under Deployments → the deployment → **Building**.

| Symptom in the log | Cause and fix |
| --- | --- |
| The log shows pnpm 9 or 10, or `ERR_PNPM_…` about the lockfile or `devEngines` | Corepack isn't on. Add `ENABLE_EXPERIMENTAL_COREPACK=1` (Production and Preview) and redeploy. |
| `Cannot find module '@ctrlp/…'` | The workspace wasn't installed. Check Root Directory is exactly `apps/server`, and that Settings → Build and Deployment → Root Directory → **Include files outside the root directory** is on (the default for monorepos). |
| `Missing required environment variable …` at runtime (in Logs) | A variable is missing or scoped to the wrong environment. Add it, then **Redeploy** (env changes need a new deployment). |
| `FAILED_PRECONDITION … requires an index` | Step 4 isn't finished; wait for the indexes. |

## Step 6. Deploy the web app to App Hosting

### 6.1 The proxy secret

The web app's `/api` proxy forwards every customer request to the API. Vercel replaces `X-Forwarded-For` with the address of whoever called it (here, the web app's server), so the proxy also sends the visitor's IP in `x-ctrlp-client-ip`, signed by a shared secret, `CTRLP_PROXY_SECRET`. The API trusts that header only when the secret matches. Without it, every guest's cookie would be tied to the web app's changing outgoing IP, and carts would fail with 401.

Use **the same value** in Vercel (step 5.2) and here:

```bash
pnpm exec firebase apphosting:secrets:set CTRLP_PROXY_SECRET --project meetctrlp
```

The command asks for the value with hidden input.

### 6.2 Create the backend

```bash
pnpm exec firebase apphosting:backends:create --project meetctrlp
```

| Prompt | Answer |
| --- | --- |
| Region | The one nearest India that the CLI offers (`asia-southeast1` if listed) |
| GitHub connection and repository | `smarty-code/meetctrlp` |
| Root directory | `apps/printUserWebapp` |
| Live branch | The branch you deploy (`fix/upload` today; `main` once merged) |
| Automatic rollouts | Yes |
| Backend ID | `ctrlp-web` |

The CLI prints the URL, for example `https://ctrlp-web--meetctrlp.asia-southeast1.hosted.app`. That's `<web-url>`. The first rollout starts right away and misbehaves until the env is in place.

Let the backend read the proxy secret:

```bash
pnpm exec firebase apphosting:secrets:grantaccess CTRLP_PROXY_SECRET --backend ctrlp-web --project meetctrlp
```

### 6.3 Env and rollout

1. Copy the web app block from the env sheet ([section 2.2](../../../docs/deploy/ENVIRONMENT.md#22-app-hosting-appsprintuserwebappapphostingyaml-whole-file)) into [`apps/printUserWebapp/apphosting.yaml`](../../printUserWebapp/apphosting.yaml), replacing the file. Fill in `<api-url>` and the Firebase web config.
2. Commit and push to the live branch. Watch Firebase console → App Hosting → `ctrlp-web` → Rollouts.

The file holds only plain values and the secret's **name**, so it's safe to commit. To roll out without a push:

```bash
pnpm exec firebase apphosting:rollouts:create ctrlp-web --git-branch fix/upload --project meetctrlp
```

| Symptom | Cause and fix |
| --- | --- |
| `Cannot find module '@ctrlp/ui'` or `workspace:*` errors | Check the root directory is exactly `apps/printUserWebapp`. The repo's `turbo.json`, `pnpm-workspace.yaml` and `pnpm-lock.yaml` at the root are the monorepo layout App Hosting expects. |
| `secret … not found` or permission denied | Step 6.1/6.2: create the secret, or grant `ctrlp-web` access. |
| The site calls `localhost:3000` | `NEXT_PUBLIC_API_BASE_URL` wasn't available at build time. It's built into the app; fix it and roll out again. |
| Every cart call returns 401 | `CTRLP_PROXY_SECRET` differs between Vercel and App Hosting, or one side is missing it. |

## Step 7. Connect the two URLs

1. In Vercel, set `PRINT_USER_ORIGIN` to `<web-url>` (Settings → Environment Variables), then **Redeploy** the latest production deployment. The API uses it for shop QR codes, customer links and CORS.
2. Check the web app's `apphosting.yaml` has `NEXT_PUBLIC_API_BASE_URL: <api-url>`.

## Step 8. Storage CORS for browser uploads

The customer's browser `PUT`s each file straight to the Railway bucket with a presigned URL, so the bucket must allow the web app's origin. In Railway's bucket settings (or with any S3 tool against the bucket), set a CORS rule like:

```json
[
  {
    "AllowedOrigins": ["https://ctrlp-web--meetctrlp.asia-southeast1.hosted.app", "http://localhost:3002"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Use your real `<web-url>` and add any custom domain. Without this rule uploads fail in the browser with a CORS error, while the API looks healthy.

## Step 9. The daily clean-up (Vercel Cron)

[`apps/server/vercel.json`](../vercel.json) schedules `GET /api/v1/internal/maintenance/daily` at `0 22 * * *` (UTC), which is 03:30 in India. Vercel sends `Authorization: Bearer <CRON_SECRET>`, and the route accepts it when it matches the `CRON_SECRET` env var. So the only setup is `CRON_SECRET` in the Vercel env (it's in the env sheet's block). On Hobby the run lands somewhere inside that hour.

The run removes tracking copies of orders finished more than 30 days ago, expired guest sessions (their cart files and Firebase Auth users), and the files of rejected or cancelled orders. It's bounded and safe to repeat.

Check it: Settings → **Cron Jobs** lists the job; **Run** triggers it now, and **View Logs** shows the response with what each step removed. To run it by hand:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<api-url>/api/v1/internal/maintenance/daily
```

The route also accepts `POST` with `x-ctrlp-maintenance-secret: <CTRLP_MAINTENANCE_SECRET>`, for any other scheduler. That variable is optional on Vercel.

## Step 10. Restrict the API keys

Google Cloud Console → APIs & Services → Credentials:

- **The web app's key** (`NEXT_PUBLIC_FIREBASE_API_KEY`): Application restrictions → Websites → `<web-url>` (and any custom domain). API restrictions → Identity Toolkit API, Token Service API, Cloud Firestore API.
- **The desktop's key** (`VITE_FIREBASE_API_KEY`, used by the agent): API restrictions → Token Service API and Firebase Realtime Database API. It can't have a website restriction (it's called from a Windows process), so keep it to those APIs.
- **The API's key** (`FIREBASE_WEB_API_KEY`): Identity Toolkit API and Token Service API. It's called from Vercel, whose outgoing IPs aren't fixed, so don't add an IP restriction.

Using one key for all three is allowed but gives up these limits.

## Step 11. Alerts

- **Google Cloud budget:** Cloud Billing → Budgets & alerts → a monthly budget of about $5 for `meetctrlp`, with alerts at 50%, 90% and 100%. This covers Firestore, Realtime Database, Auth and the web app.
- **Firebase usage:** Cloud Monitoring → Alerting, on Firestore document reads (more than 40,000 a day), Firestore document writes (more than 16,000 a day), Realtime Database bytes sent (on pace for more than 7 GB a month), and the web app's Cloud Run request count (more than 50,000 a day).
- **Vercel:** Settings → Billing → **Spend Management** (Pro), or watch Usage on Hobby. The API's logs are in Vercel → Logs. Search for `ring_failed` (a doorbell ring never reached the database) and `ring_unknown` (it timed out and may have landed). More than 10 `ring_failed` in an hour means desktops are only catching up by polling. On Pro, a Log Drain can forward these to an alerting tool.

## Step 12. Build the shop desktop installer

On a Windows PC with the desktop toolchain (`pnpm desktop:setup`):

1. Create `apps/print-shop/.env.production` from the env sheet's desktop block (section 3), with `<api-url>` as `VITE_SERVER_BASE_URL`. Vite builds these values into the app.
2. Build:

   ```bash
   pnpm desktop:build
   ```

3. The installer is in `apps/print-shop/src-tauri/target/release/bundle/nsis/`. Install it on the shop PC and log in.

The API already allows the Tauri app's origins (`tauri://localhost`, `https://tauri.localhost`); `DESKTOP_ORIGIN` is only for anything else.

## Updating later

- **Code:** push to the production branch. Vercel deploys the API; App Hosting rolls out the web app. A failed build leaves the previous version serving.
- **Rules or indexes changed:** run `pnpm firebase:rules:test`, then step 4, **before** pushing the code that needs them.
- **An API env value:** change it in Vercel, then Redeploy. Changing `PRINT_USER_COOKIE_SECRET` signs every guest out. Changing `CTRLP_PROXY_SECRET` must happen on both sides at once.
- **A web app secret:** `pnpm exec firebase apphosting:secrets:set NAME --project meetctrlp`, then roll out again.
- **Roll back the API:** Vercel → Deployments → an earlier production deployment → **Instant Rollback**. The cron reverts with it.
- **Roll back the web app:** App Hosting → `ctrlp-web` → Rollouts → an earlier rollout → **Roll back**.
- **Desktop:** rebuild the installer and reinstall; the agent updates with it.

---

# Part 2: How the API behaves on Vercel

Each API route runs as a Vercel Function (Node.js runtime):

- Instances start on demand and stop when idle; the first request after a quiet period pays for a cold start. With Fluid compute one instance serves several requests at once.
- A function runs for at most the max duration (300 s by default here). Hobby gives 2 GB of memory.
- A request **body** can be at most **4.5 MB**.
- `/tmp` belongs to one instance and disappears with it.
- Vercel overwrites `X-Forwarded-For` with the caller's address. That's why the web app's proxy signs the visitor's IP (step 6.1).

## Uploads

File bytes never pass through the API. The browser `PUT`s each file straight to Railway storage with a presigned URL, so the 4.5 MB body limit doesn't apply to uploads. Two API calls happen per file (see [`print-user.md`](./print-user.md#uploading-one-file)):

1. `POST .../documents` creates the intent and presigned URL. It's a small JSON request.
2. `POST .../documents/{docId}/complete` downloads the file from Railway, checks it, counts pages, and hashes it:

| Risk on serverless | What handles it |
| --- | --- |
| Cold start makes the check slow. | The web app's button shows **Checking documents…** at 99%, so the page doesn't look frozen. |
| A large file runs the instance out of memory. | `complete` reads the object's size first and rejects anything over 50 MB before downloading it. 2 GB leaves room for several large PDFs at once. |
| The instance drops the request, or returns 429/5xx while scaling. | The web app retries `complete` up to 3 times (after 1 s, then 2 s). `complete` is idempotent. A 400 means the file itself is unusable and is not retried. |
| Storage is briefly unreachable. | `complete` returns 500 (retried) instead of 400. It returns 400 only when the object really doesn't exist. |

Every check downloads the whole file from Railway to Vercel's region, so its time depends on the distance between them.

## Desktops

No desktop holds a connection to the API ([traffic scaling v2](../../../docs/arc/traffic-scaling-v2/README.md)). The shop's agent waits on its doorbell, `/doorbell/{shopId}` in Realtime Database, over a REST stream that Google serves. When the API changes a shop's orders or jobs it rings the doorbell, and the agent and the desktop make short requests:

- `POST /api/v1/shops/{shopId}/agents/{agentId}/sync` claims work; `.../jobs/report` reports results.
- `GET /api/v1/shops/{shopId}/board?since=…` fetches what changed on the board.

So an idle shop costs no API requests, nothing waits on a long-lived request, and instances don't need to share memory: Firestore is the only state. A shop whose doorbell stream keeps breaking polls the doorbell (not the API) every 60 seconds.

## What doesn't work on serverless

- **Local disk fallback:** `storeDocument` in [`document.service.ts`](../src/modules/documents/document.service.ts) writes to `data/print-jobs` when the `S3_*` variables are missing. On Vercel that folder isn't writable or doesn't survive, so always set the `S3_*` variables.
- **Files in the request body:** `POST /api/v1/shops/{shopId}/orders/documents` takes files as multipart form data, so the 4.5 MB body limit applies. Only the seed script (`scripts/seed-print-order.mjs`) uses this route; run it against a local server.

---

# Part 3: Test after each deploy

Set `$API` and `$WEB` to the two URLs.

## Smoke checks (5 minutes)

| Check | Pass |
| --- | --- |
| `curl -s $API/api/health` | `200` |
| `curl -s $API/api/v1/public/shops/<a-shop-slug>` | `200` with `{ "shop": … }` |
| `curl -s $API/api/v1/internal/maintenance/daily` | `401` (the route is up and guarded) |
| Vercel → Settings → Cron Jobs → **Run** | The log shows `200` and the clean-up counts |
| Open `$WEB/s/<a-shop-slug>` in a phone browser | The shop page loads and shows opening hours |
| Upload a PDF and an image | Both reach **Ready**; no CORS error in the browser console (step 8) |
| Go through upload → customize → review on the phone | No 401s (proves the proxy secret, step 6.1) |
| Place a cash order | The tracking page shows "Order received" |
| On the desktop (installed from step 12), log in | The order appears; Settings shows the doorbell **connected** |
| Accept and print it | The tracking page moves to Printing, then Ready, with no Refresh |

## Full pass

Run the manual cases in the [testing guide](../../../docs/arc/traffic-scaling-v2/TESTING_GUIDE.md):

1. Sections 3–7 (server: auth, payments, orders and jobs, rings, guest cookie) against `$API`.
2. Sections 8–10 on a shop PC with the installer: connection, sync and printing, the board.
3. Section 11 on a phone and a desktop browser against `$WEB`.
4. Section 12: the idle and cost checks (set `FIRESTORE_OP_COUNTERS=1` in Vercel for that run, and read the `request_ops` lines in Vercel → Logs), the cron, and cold starts.

Record results in the sheet in section 15.

## Still to confirm on the first deploy

- **IP binding through the proxy:** two phones on different networks must get different carts, and one phone's cart must keep working across pages. If carts fail with 401, compare `CTRLP_PROXY_SECRET` on both sides.
- **Build from a subdirectory:** the first deploys prove the pnpm workspace packages (`@ctrlp/firebase`, `@ctrlp/schemas`, `@ctrlp/types`, `@ctrlp/ui`) build from each root directory, and that Corepack picks pnpm 11 on Vercel.
- **Cold starts:** measure the first `complete` and the first desktop board fetch after an idle hour.
- **Guest sign-in billing:** see step 3.
