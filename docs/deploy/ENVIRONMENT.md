# Environment variables: copy-paste sheet

Every variable each app reads, in blocks you can paste whole. Replace each `<…>` and nothing else. How to deploy is in [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md): the API runs on **Vercel**, the customer web app on **Firebase App Hosting**, and the desktop is an installer.

**Environment files** may live in the repo (see root `.gitignore`) or only on hosts (Vercel, App Hosting secrets). The `apphosting.yaml` block below holds plain values and a secret **name** for Firebase-hosted rollouts.

Values used below:

| Placeholder | Where to get it |
| --- | --- |
| `<api-url>` | The API's Vercel production URL, for example `https://ctrlp-api.vercel.app` (or your custom domain) |
| `<web-url>` | The web app's App Hosting URL, for example `https://ctrlp-web--meetctrlp.asia-southeast1.hosted.app` |
| `<random>` | A fresh random value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `<firebase-web-api-key>`, `<firebase-app-id>` | Firebase console → Project settings → General → Your apps → the Web app's config (`apiKey`, `appId`) |
| `<s3-endpoint>`, `<s3-bucket>` | Railway → the bucket → Credentials |

---

## 1. API (`apps/server`)

### 1.1 Local development: `apps/server/.env.local`

`next dev` and `next build` both read `.env.local`. Mock payments go in `.env.development.local`, which only `next dev` reads, so a production build can never pick them up.

```dotenv
# --- Firebase Admin (required) ---
# Base64 of the service-account JSON (see "API secrets" below for the command).
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 of the service-account JSON>
# Web API key: password sign-in and token refresh.
FIREBASE_WEB_API_KEY=<firebase-web-api-key>
# Realtime Database for the shop doorbell. Unset = rings are skipped.
FIREBASE_DATABASE_URL=https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app

# --- Storage: Railway S3 (required; without it files go to a local folder) ---
S3_ENDPOINT=<s3-endpoint>
S3_BUCKET_NAME=<s3-bucket>
S3_REGION=auto
S3_ACCESS_KEY_ID=<s3 access key id>
S3_SECRET_ACCESS_KEY=<s3 secret access key>

# --- URLs ---
# The customer web app (QR codes, customer links, CORS). Local web app runs on 3002.
PRINT_USER_ORIGIN=http://localhost:3002
# Optional extra CORS origins, comma-separated. The Tauri origins are built in.
DESKTOP_ORIGIN=

# --- Secrets the server checks (optional locally) ---
# Guest cookie signing, 32+ characters. Unset locally = a per-process secret: every dev-server restart gives each visitor a new, empty cart. Set one to keep carts.
PRINT_USER_COOKIE_SECRET=
# Shared with the web app's /api proxy: lets the API trust the visitor IP the proxy sends (logged on new guest sessions).
# Optional locally (unset = use X-Forwarded-For). Recommended on Vercel.
CTRLP_PROXY_SECRET=
# The daily clean-up accepts Authorization: Bearer <CRON_SECRET> (what Vercel Cron sends)...
CRON_SECRET=
# ...or x-ctrlp-maintenance-secret: <CTRLP_MAINTENANCE_SECRET> (any other scheduler, or by hand).
CTRLP_MAINTENANCE_SECRET=
# Header value for the payment-confirmed webhook.
CTRLP_PAYMENT_WEBHOOK_SECRET=
# Header value for the desktop's printer inventory upload.
PRINTER_INVENTORY_API_KEY=

# --- Diagnostics ---
# 1 = log a request_ops line (Firestore reads/writes, rings) per request.
FIRESTORE_OP_COUNTERS=
```

`apps/server/.env.development.local`:

```dotenv
# Lets the web app confirm ONLINE payments without a gateway. Development only.
ALLOW_MOCK_PAYMENTS=1
```

Fallback if you can't use the base64 value: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` (with `\n` for line breaks) instead of `FIREBASE_SERVICE_ACCOUNT_BASE64`. `SERVICE_NAME` (default `ctrlp-server`) only changes the name in logs.

### 1.2 Vercel: Production environment

Vercel project `ctrlp-api` → Settings → **Environment Variables** → paste this whole block into the **Key** field (Vercel splits it into one variable per line), fill in the values, choose **Production** (and Preview if you use preview deployments), and mark everything except the URLs and `ENABLE_EXPERIMENTAL_COREPACK` as **Sensitive**. Then redeploy: env changes apply to new deployments only.

```dotenv
# --- Build ---
# Use the pnpm version pinned in the root package.json (pnpm 11); Vercel's own pnpm stops at 10.
ENABLE_EXPERIMENTAL_COREPACK=1

# --- Firebase Admin ---
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64 of the NEW service-account JSON>
FIREBASE_WEB_API_KEY=<firebase-web-api-key>
FIREBASE_DATABASE_URL=https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app

# --- Storage: Railway S3 ---
S3_ENDPOINT=<s3-endpoint>
S3_BUCKET_NAME=<s3-bucket>
S3_REGION=auto
S3_ACCESS_KEY_ID=<NEW s3 access key id>
S3_SECRET_ACCESS_KEY=<NEW s3 secret access key>

# --- URLs ---
PRINT_USER_ORIGIN=<web-url>

# --- Secrets ---
# Guest cookie signing. Required in production. Changing it signs every guest out.
PRINT_USER_COOKIE_SECRET=<random>
# Must equal CTRLP_PROXY_SECRET on the web app (App Hosting secret).
CTRLP_PROXY_SECRET=<random>
# Vercel Cron sends Authorization: Bearer <CRON_SECRET> to the daily clean-up.
CRON_SECRET=<random>
# Header value for the payment-confirmed webhook (x-ctrlp-payment-secret).
CTRLP_PAYMENT_WEBHOOK_SECRET=<random>
# Header value for the printer inventory upload (x-printer-inventory-key).
PRINTER_INVENTORY_API_KEY=<random>
```

Optional lines to add to the same block:

```dotenv
# There's no payment gateway yet, so ONLINE orders can only be paid through the mock route.
# 1 lets any guest mark their own order paid. Leave it out to allow cash orders only.
ALLOW_MOCK_PAYMENTS=1
# Log a request_ops line per request (Firestore reads/writes, rings). Turn on for the cost check, then remove.
FIRESTORE_OP_COUNTERS=1
# Only if another scheduler (not Vercel Cron) calls the clean-up with a header.
CTRLP_MAINTENANCE_SECRET=<random>
```

Or with the Vercel CLI, one variable at a time (the value is read from the prompt, not your history):

```bash
pnpm dlx vercel env add PRINT_USER_COOKIE_SECRET production
```

### API secrets: how to produce each value

| Variable | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | The new service-account key (deploy guide step 0), base64. PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json")) \| Set-Clipboard`, then paste. Delete the JSON file afterwards. |
| `FIREBASE_WEB_API_KEY` | The Web app's `apiKey` (Firebase console → Project settings). |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | The new Railway key (Railway → bucket → Credentials). |
| `PRINT_USER_COOKIE_SECRET`, `CTRLP_PROXY_SECRET`, `CRON_SECRET`, `CTRLP_PAYMENT_WEBHOOK_SECRET`, `PRINTER_INVENTORY_API_KEY` | A separate `<random>` each. Save `CTRLP_PROXY_SECRET` for the web app (section 2.2). |

### Every API variable

| Variable | Kind | Required | Notes |
| --- | --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | secret | yes | Firebase Admin credentials. The code doesn't use the backend's default credentials. |
| `FIREBASE_WEB_API_KEY` | secret | yes | Password sign-in and token refresh. |
| `FIREBASE_DATABASE_URL` | plain | yes | Doorbell rings. Without it the server skips rings and logs `ring_skipped` once, and desktops only learn of changes by polling. |
| `S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_REGION` | plain | yes | Railway storage. `S3_REGION` is `auto`. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | secret | yes | |
| `PRINT_USER_ORIGIN` | plain | yes | The web app's URL (QR codes, customer links, CORS). Comma-separate to add a custom domain. |
| `PRINT_USER_COOKIE_SECRET` | secret | **yes in production** | Without it every guest request fails with `503 authentication is not configured`. Changing it signs every guest out. |
| `CTRLP_PROXY_SECRET` | secret | recommended behind the web app on Vercel | Lets the API trust the visitor IP the web app's proxy sends. That IP is recorded on new guest sessions for abuse logging; it doesn't identify the guest. Must match the web app's. Missing or different: carts still work, but the web app's own address is recorded. |
| `CRON_SECRET` | secret | for the Vercel cron | Vercel Cron sends it as `Authorization: Bearer …` to the daily clean-up. Unset: the cron gets 401. |
| `CTRLP_MAINTENANCE_SECRET` | secret | no | Lets another scheduler, or you, call the clean-up with `x-ctrlp-maintenance-secret`. |
| `ENABLE_EXPERIMENTAL_COREPACK` | plain | yes on Vercel | `1`: build with the repo's pinned pnpm 11. |
| `CTRLP_PAYMENT_WEBHOOK_SECRET` | secret | for the webhook | Unset: the payment webhook rejects every call. |
| `PRINTER_INVENTORY_API_KEY` | secret | for inventory uploads | Unset: `POST /api/printers/inventory` is refused. |
| `DESKTOP_ORIGIN` | plain | no | Extra CORS origins. |
| `ALLOW_MOCK_PAYMENTS` | plain | no | `1` enables the guest mock payment route. See the comment in 1.2. |
| `FIRESTORE_OP_COUNTERS` | plain | no | `1` logs `request_ops` lines. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | secret | no | Fallback for the base64 credential. |
| `SERVICE_NAME` | plain | no | Log name. |

`NODE_ENV` is set by Next.js. `DATABASE_URL` and `FIREBASE_STORAGE_BUCKET`, which older env files listed, aren't read by the code.

---

## 2. Customer web app (`apps/printUserWebapp`)

### 2.1 Local development: `apps/printUserWebapp/.env.local`

```dotenv
# The API. The web app's /api proxy forwards to it.
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000

# Firebase web config for the tracking page's live listener. Leave all four empty to read once with Refresh.
NEXT_PUBLIC_FIREBASE_API_KEY=<firebase-web-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=meetctrlp.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=meetctrlp
NEXT_PUBLIC_FIREBASE_APP_ID=<firebase-app-id>

# Server-only. Same value as the API's CTRLP_PROXY_SECRET. Optional locally.
CTRLP_PROXY_SECRET=
```

### 2.2 App Hosting: `apps/printUserWebapp/apphosting.yaml` (whole file)

`NEXT_PUBLIC_*` values are built into the app, so they need `BUILD`; the `/api` proxy also reads the API URL at runtime. Create the proxy secret first, with the **same value** as the API's `CTRLP_PROXY_SECRET`:

```bash
pnpm exec firebase apphosting:secrets:set CTRLP_PROXY_SECRET --project meetctrlp
```

```bash
pnpm exec firebase apphosting:secrets:grantaccess CTRLP_PROXY_SECRET --backend ctrlp-web --project meetctrlp
```

```yaml
# Firebase App Hosting backend for apps/printUserWebapp (backend ctrlp-web, root directory apps/printUserWebapp).

runConfig:
  cpu: 1
  memoryMiB: 512
  concurrency: 80
  minInstances: 0

env:
  - variable: NEXT_PUBLIC_API_BASE_URL
    value: <api-url>
    availability:
      - BUILD
      - RUNTIME
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: <firebase-web-api-key>
    availability:
      - BUILD
      - RUNTIME
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: meetctrlp.firebaseapp.com
    availability:
      - BUILD
      - RUNTIME
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: meetctrlp
    availability:
      - BUILD
      - RUNTIME
  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: <firebase-app-id>
    availability:
      - BUILD
      - RUNTIME
  # Server-only: signs the visitor IP the /api proxy sends to the API (Vercel overwrites X-Forwarded-For).
  - variable: CTRLP_PROXY_SECRET
    secret: CTRLP_PROXY_SECRET
    availability:
      - RUNTIME
```

The Firebase web `apiKey` and `appId` are public by design (every visitor's browser gets them), so a plain value is fine. Restrict the key instead (deploy guide step 10).

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | The API URL. A change needs a new rollout. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | Live tracking. Without them the tracking page reads once and shows Refresh. |
| `CTRLP_PROXY_SECRET` | Secret, runtime only. Same value as the API's. Without it, the API can't see the visitor's IP and records the proxy's instead; carts still work. |

---

## 3. Shop desktop (`apps/print-shop`)

Vite builds these into the app.
- **`pnpm desktop:dev`** reads `apps/print-shop/.env.development`.
- **The installer** (`pnpm desktop:build`) and `pnpm desktop:prod` read `apps/print-shop/.env.production`.

If the dev file is missing, the agent starts with no API key and no doorbell URL. The agent log then shows `cloud.configure … database=(none) apiKey=missing`, and the desktop shows the shop cloud as **Offline**, even though sign-in works. The API also needs `FIREBASE_DATABASE_URL` (section 1) or it never rings the doorbell.

`apps/print-shop/.env.development` (local API):

```dotenv
VITE_SERVER_BASE_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=<firebase-web-api-key>
VITE_FIREBASE_DATABASE_URL=https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app
```

`apps/print-shop/.env.production` (installer for shops):

```dotenv
VITE_SERVER_BASE_URL=<api-url>
VITE_FIREBASE_API_KEY=<firebase-web-api-key>
VITE_FIREBASE_DATABASE_URL=https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app
```

| Variable | Notes |
| --- | --- |
| `VITE_SERVER_BASE_URL` | The API. Default `http://localhost:3000`. |
| `VITE_FIREBASE_API_KEY` | Passed to the print agent, which refreshes the PC's ID token with it (Token Service API) and reads the doorbell. Can be the same key as the web app's, or a separate key restricted to Token Service and Realtime Database. |
| `VITE_FIREBASE_DATABASE_URL` | The doorbell database. Without it the agent can't connect and the desktop only updates on its own actions. |

The print agent has no env of its own: the desktop sends it these values (`cloud.configure`).

---

## 4. Tests and tools

| Variable | Used by | Notes |
| --- | --- | --- |
| `SERVER_BASE_URL`, `SHOP_ID`, `SHOP_TOKEN`, `FIXTURE`, `PAYMENT_METHOD` | `pnpm --filter server seed:print-order` | Local server only; see the order-to-print runbook. |
| (none) | `pnpm --filter server test:emulator`, `pnpm firebase:rules:test` | They set their own emulator hosts and `demo-` projects, and strip real credentials. |
