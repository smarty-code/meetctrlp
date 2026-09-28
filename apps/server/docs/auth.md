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

## Endpoints

All JSON. Errors: `{ "error": "message" }`.

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | none | `{ name, shopName, password, email?, phone? }` — email or phone required. Creates a shop + OWNER. `201` |
| POST | `/api/auth/login` | none | `{ identifier, password }` — identifier is email or phone |
| POST | `/api/auth/refresh` | none | `{ refreshToken }` |
| POST | `/api/auth/logout` | Bearer idToken | revokes Firebase refresh tokens |
| GET | `/api/auth/me` | Bearer idToken | current ACTIVE shop user |
| POST | `/api/v1/devices/register` | Bearer idToken | `{ deviceIdentifier, hostname, osVersion, appVersion, agentVersion }` |
| POST | `/api/v1/devices/heartbeat` | Bearer idToken | `{ deviceId, memoryWorkingSetBytes?, spoolerJobCount?, onlinePrinterCount? }` |
| POST | `/api/v1/devices/offline` | Bearer idToken | `{ deviceId }` |
| GET | `/api/v1/shops/profile` | Bearer idToken | shop name, phone, email, status, and address when stored |
| GET | `/api/v1/shops/staff` | Bearer idToken | ACTIVE staff on the caller's shop |

Shop settings, for the signed-in shop only:

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/v1/shops/{shopId}/pricing` | pricing, capabilities, business hours, `openNow` |
| PUT | `/api/v1/shops/{shopId}/pricing` | `{ bwA4PricePaise, colorA4PricePaise, colorA3PricePaise }` from 50 to 10000 |
| PUT | `/api/v1/shops/{shopId}/capabilities` | `{ colorPrinting, a3Printing }` |
| PUT | `/api/v1/shops/{shopId}/hours` | `{ businessHours: [{ dayOfWeek, opensAt, closesAt, isClosed }] }` seven days |
| POST | `/api/v1/shops/{shopId}/pricing/quote` | `{ billablePages, copies, colorMode, paperSize }` |

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
- `401` invalid credentials or missing/invalid bearer token
- `403` shop user not ACTIVE
- `409` email or phone already exists
- `429` Firebase rate limit
- `503` Firebase Admin credentials missing, rejected, or this PC's clock is out of sync with Google

## Code

- Routes: `app/api/auth/*/route.ts`
- Service: `src/modules/auth/auth.service.ts`
- Guard: `requireShopUser(idToken)` — verify the Firebase ID token, then load the ACTIVE user from `shops/{shopId}/users/{userId}`
- Store: `src/modules/shops/firestore-shop-store.ts`
