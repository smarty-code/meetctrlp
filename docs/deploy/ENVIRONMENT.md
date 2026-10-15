# Environment variables: copy-paste sheet

Every variable each app reads, in blocks you can paste whole. Replace each `<…>` and nothing else. How to deploy is in [`apps/server/docs/deployment.md`](../../apps/server/docs/deployment.md).

**Never commit a filled-in `.env*` file.** Real values go in local, untracked files (`.env.local`, `.env.development.local`, `.env.production`) or in App Hosting secrets. The `apphosting.yaml` blocks below hold only plain values and secret **names**, so they're safe to commit.

Values used below:

| Placeholder | Where to get it |
| --- | --- |
| `<api-url>` | The API backend's URL from `apphosting:backends:create`, for example `https://ctrlp-api--meetctrlp.asia-southeast1.hosted.app` |
| `<web-url>` | The web app backend's URL, for example `https://ctrlp-web--meetctrlp.asia-southeast1.hosted.app` |
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
# Guest cookie signing, 32+ characters. Unset locally = a per-process secret (guests reset on restart).
PRINT_USER_COOKIE_SECRET=
# Header value for POST /api/v1/internal/maintenance/daily. Unset = the route always returns 401.
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

### 1.2 App Hosting: `apps/server/apphosting.yaml` (whole file)

```yaml
# Firebase App Hosting backend for apps/server (backend ctrlp-api, root directory apps/server).
# Secrets are referenced by name; create them first (docs/deploy/ENVIRONMENT.md, "API secrets").

runConfig:
  cpu: 1
  # `complete` holds a whole upload (up to 50 MB) in memory while it counts pages.
  memoryMiB: 1024
  concurrency: 80
  # Scale to zero: nothing holds a connection open. Set to 1 to avoid cold starts (always billed).
  minInstances: 0

env:
  # --- Firebase ---
  - variable: FIREBASE_SERVICE_ACCOUNT_BASE64
    secret: FIREBASE_SERVICE_ACCOUNT_BASE64
    availability:
      - RUNTIME
  - variable: FIREBASE_WEB_API_KEY
    secret: FIREBASE_WEB_API_KEY
    availability:
      - RUNTIME
  - variable: FIREBASE_DATABASE_URL
    value: https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app
    availability:
      - RUNTIME

  # --- Storage (Railway S3) ---
  - variable: S3_ENDPOINT
    value: <s3-endpoint>
    availability:
      - RUNTIME
  - variable: S3_BUCKET_NAME
    value: <s3-bucket>
    availability:
      - RUNTIME
  - variable: S3_REGION
    value: auto
    availability:
      - RUNTIME
  - variable: S3_ACCESS_KEY_ID
    secret: S3_ACCESS_KEY_ID
    availability:
      - RUNTIME
  - variable: S3_SECRET_ACCESS_KEY
    secret: S3_SECRET_ACCESS_KEY
    availability:
      - RUNTIME

  # --- URLs ---
  - variable: PRINT_USER_ORIGIN
    value: <web-url>
    availability:
      - RUNTIME

  # --- Secrets the server checks ---
  - variable: PRINT_USER_COOKIE_SECRET
    secret: PRINT_USER_COOKIE_SECRET
    availability:
      - RUNTIME
  - variable: CTRLP_MAINTENANCE_SECRET
    secret: CTRLP_MAINTENANCE_SECRET
    availability:
      - RUNTIME
  - variable: CTRLP_PAYMENT_WEBHOOK_SECRET
    secret: CTRLP_PAYMENT_WEBHOOK_SECRET
    availability:
      - RUNTIME
  - variable: PRINTER_INVENTORY_API_KEY
    secret: PRINTER_INVENTORY_API_KEY
    availability:
      - RUNTIME

  # --- Online payments without a gateway ---
  # There's no payment gateway yet, so ONLINE orders can only be paid through the mock route.
  # "1" lets any guest mark their own order paid. Leave it out to allow cash orders only.
  # - variable: ALLOW_MOCK_PAYMENTS
  #   value: "1"
  #   availability:
  #     - RUNTIME

  # --- Cost investigation (turn on for the staging cost check, then remove) ---
  # - variable: FIRESTORE_OP_COUNTERS
  #   value: "1"
  #   availability:
  #     - RUNTIME
```

### API secrets

Create each with hidden input (the value never goes into history or a file):

```bash
pnpm exec firebase apphosting:secrets:set <NAME> --project meetctrlp
```

| Secret | Value | How to produce it |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | The new service-account key (step 0 of the deploy guide), base64 | PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json")) \| Set-Clipboard`, then paste at the prompt. Delete the JSON file afterwards. |
| `FIREBASE_WEB_API_KEY` | The Web app's `apiKey` | Firebase console → Project settings |
| `S3_ACCESS_KEY_ID` | New Railway key ID | Railway → bucket → Credentials |
| `S3_SECRET_ACCESS_KEY` | New Railway secret | Same |
| `PRINT_USER_COOKIE_SECRET` | 32+ random characters | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `CTRLP_MAINTENANCE_SECRET` | Random | Same command. Cloud Scheduler sends it (deploy guide step 9). |
| `CTRLP_PAYMENT_WEBHOOK_SECRET` | Random | Same command. Whoever calls the payment webhook sends it as `x-ctrlp-payment-secret`. |
| `PRINTER_INVENTORY_API_KEY` | Random | Same command. Sent as `x-printer-inventory-key` to `POST /api/printers/inventory`. |

Then let the backend read them (once per secret, after the backend exists):

```bash
pnpm exec firebase apphosting:secrets:grantaccess FIREBASE_SERVICE_ACCOUNT_BASE64,FIREBASE_WEB_API_KEY,S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY,PRINT_USER_COOKIE_SECRET,CTRLP_MAINTENANCE_SECRET,CTRLP_PAYMENT_WEBHOOK_SECRET,PRINTER_INVENTORY_API_KEY --backend ctrlp-api --project meetctrlp
```

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
| `CTRLP_MAINTENANCE_SECRET` | secret | for the clean-up | Unset: the maintenance route always returns 401. |
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
```

### 2.2 App Hosting: `apps/printUserWebapp/apphosting.yaml` (whole file)

`NEXT_PUBLIC_*` values are built into the app, so they need `BUILD`; the `/api` proxy also reads the API URL at runtime.

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
```

The Firebase web `apiKey` and `appId` are public by design (every visitor's browser gets them), so a plain value is fine. Restrict the key instead (deploy guide step 10).

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | The API URL. A change needs a new rollout. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | Live tracking. Without them the tracking page reads once and shows Refresh. |

---

## 3. Shop desktop (`apps/print-shop`)

Vite builds these into the app. For `pnpm desktop:dev` use `apps/print-shop/.env`; for the installer (`pnpm desktop:build`) use `apps/print-shop/.env.production`, which a production build reads on top of `.env`.

`apps/print-shop/.env` (local API):

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
