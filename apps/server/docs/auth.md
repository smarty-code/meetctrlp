# Shop-owner authentication

The desktop app does not talk to Firebase. It POSTs credentials to this server. Firebase Authentication owns passwords and session tokens. Cloud Firestore stores the shop and staff profile.

Package docs:

- [`packages/firebase/docs/AUTH.md`](../../../packages/firebase/docs/AUTH.md)
- [`packages/types/docs/README.md`](../../../packages/types/docs/README.md)
- [`packages/schemas/docs/README.md`](../../../packages/schemas/docs/README.md)

## Environment

Fill `apps/server/.env.local` (gitignored). Do not commit secrets.

```env
FIREBASE_SERVICE_ACCOUNT_BASE64=
FIREBASE_WEB_API_KEY=
DESKTOP_ORIGIN=
```

`DESKTOP_ORIGIN` is optional. CORS already allows the Tauri print-shop origins (`http://localhost:1420`, `https://tauri.localhost`). Add extra origins as a comma-separated list if needed. The desktop app still has no Firebase SDK; it calls these HTTP APIs.

`FIREBASE_WEB_API_KEY` is the Web API key in Firebase Console → Project settings → General. Enable the Email/Password provider.

Register, login, refresh, and `/me` use that Web API key for passwords. Firebase Admin (`FIREBASE_SERVICE_ACCOUNT_BASE64`) writes the shop and staff documents to Firestore, sets custom claims, and revokes refresh tokens. If Admin logs `invalid_grant` / JWT timeframe, check Windows clock sync with Google, or mint a new service-account key. Do not leave a trailing `%` on the base64 value.

Registration writes `shops/{shopId}`, `shops/{shopId}/users/{userId}`, and `authLookups/{hash}` for the Firebase uid, phone, and email. Those lookup documents replace collection-group queries.

## How requests are authorized

Every shop route verifies the bearer ID token **locally** with Firebase Admin (`verifyIdToken`, cached Google keys) and reads the caller from the token's custom claims `{ shopId, shopUserId, role }`. There is no call to Google and no Firestore read per request. The result is a `ShopPrincipal { uid, shopId, shopUserId, role }` (`packages/types`).

- **Claims are required.** Registration sets them and fails (rolling back the shop and the Firebase user) if it can't. The sign-up token is minted before the claims exist, so registration refreshes it and returns a token that carries them.
- **Login repairs claims.** If a user's token lacks the expected claims (an older account, or a changed role), login sets them and returns a refreshed token.
- **A token without claims** gets `401 CLAIMS_MISSING`. Sign in again.
- **Deactivation** isn't immediate on ordinary routes: an ID token stays valid for up to an hour. `/api/auth/me` and sign-out check the user record or revocation.

**Route audit (Oct 2026).** There are 55 route files under `app/api`: 37 use shop auth, 8 are guest routes, and 5 also accepted the agent-key header. From the principal, shop routes use only `shopId`; these also use `shopUserId` as the actor: accept, complete, collect cash, status changes, and device registration. No route uses `role` yet. Only `/api/auth/me` needs the user's name, email or phone, and it reads `shops/{shopId}/users/{shopUserId}` (1 read). The staff list and shop profile read their own documents by `shopId`.

## Endpoints

All JSON. Errors: `{ "error": "message" }`.

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | none | `{ name, shopName, password, email?, phone? }` — email or phone required. Creates a shop + OWNER. `201` |
| POST | `/api/auth/login` | none | `{ identifier, password }` — identifier is email or phone |
| POST | `/api/auth/refresh` | none | `{ refreshToken }` |
| POST | `/api/auth/logout` | Bearer idToken | `{ allDevices? }` (body optional). Signs out this device only; refresh tokens are revoked only when `allDevices` is `true`, because one login often runs on several PCs. |
| GET | `/api/auth/me` | Bearer idToken | current ACTIVE shop user (reads the user record) |
| POST | `/api/v1/devices/register` | Bearer idToken | `{ deviceIdentifier, hostname, osVersion, appVersion, agentVersion }` |
| POST | `/api/v1/devices/heartbeat` | Bearer idToken | `{ deviceId, memoryWorkingSetBytes?, spoolerJobCount?, onlinePrinterCount? }` |
| POST | `/api/v1/devices/offline` | Bearer idToken | `{ deviceId }` |
| GET | `/api/v1/shops/profile` | Bearer idToken | shop name, phone, email, status, and address when stored |
| GET | `/api/v1/shops/staff` | Bearer idToken | ACTIVE staff on the caller's shop |

Shop settings, for the signed-in shop only:

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/v1/shops/{shopId}/pricing` | pricing, capabilities, business hours (each with a 12-hour `label`), `openNow`, `openStatusLabel`, `todayHoursLabel`, `isOpen24x7` |
| PUT | `/api/v1/shops/{shopId}/pricing` | `{ bwA4PricePaise, colorA4PricePaise, colorA3PricePaise }` from 50 to 10000 |
| PUT | `/api/v1/shops/{shopId}/capabilities` | `{ colorPrinting, a3Printing }` |
| PUT | `/api/v1/shops/{shopId}/hours` | `{ businessHours: [{ dayOfWeek, opensAt, closesAt, isClosed, isOpen24Hours? }] }` seven days |
| POST | `/api/v1/shops/{shopId}/pricing/quote` | `{ billablePages, copies, colorMode, paperSize }` |

Hours rules:

- **Time format:** `opensAt` and `closesAt` accept `"9:30 PM"` or `"21:30"`. They are stored as 24-hour `HH:mm` in India time (Asia/Kolkata).
- **Past midnight:** a closing time earlier than the opening time means the shop closes after midnight. For example, `18:00`–`02:00` is open until 2:00 AM the next morning.
- **24 hours:** `isOpen24Hours: true` keeps the day open around the clock. The times are kept but ignored. The flag is optional so older desktop builds can still save hours.
- **Closed days:** a closed day always drops the 24-hour flag.
- **Rejected:** only a day whose opening and closing times are the same, with 400 `opening and closing time can't be the same. Turn on Open 24 hours instead.`

Device register returns `{ deviceId, heartbeatIntervalSeconds: 30, status: "ONLINE" }`. The agent document is `shops/{shopId}/agents/{agentId}` in Firestore. The same PC and shop always map to the same `deviceId`. Heartbeat only updates liveness and telemetry. Agents with `lastSeenAt` older than 90 seconds are marked `OFFLINE` on the next heartbeat from that shop.

Success for register/login/refresh:

```json
{
  "user": {
    "id": "uuid",
    "shopId": "uuid",
    "name": "…",
    "email": "user@example.com or null",
    "phone": "+91… or null",
    "role": "OWNER",
    "status": "ACTIVE",
    "lastLoginAt": null
  },
  "tokens": {
    "idToken": "…",
    "refreshToken": "…",
    "expiresIn": 3600
  }
}
```

The internal Firebase phone-mapping email (`*@phone.meetctrlp.app`) is never returned.

## Status codes

- `400` invalid body / phone / reserved email domain
- `401` invalid credentials, missing/invalid/expired bearer token, or `CLAIMS_MISSING` (sign in again)
- `403` shop user not ACTIVE
- `409` email or phone already exists
- `429` Firebase rate limit
- `503` Firebase Admin credentials missing, rejected, or this PC's clock is out of sync with Google

## Code

- Routes: `app/api/auth/*/route.ts`
- Service: `src/modules/auth/auth.service.ts`
- Guard: `readShopPrincipal(request)` → `requireShopPrincipal(idToken)`: verify the ID token locally and read the custom claims; no Firestore reads
- Claims helpers: `src/modules/auth/principal.ts` (tested in `principal.test.ts`)
- Store: `src/modules/shops/firestore-shop-store.ts`
