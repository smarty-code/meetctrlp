# Shop-owner authentication

The desktop app does not talk to Firebase. It POSTs credentials to this server. Firebase Authentication owns passwords and session tokens. Postgres stores the shop and OWNER profile.

Package docs:

- [`packages/firebase/docs/AUTH.md`](../../../packages/firebase/docs/AUTH.md)
- [`packages/types/docs/README.md`](../../../packages/types/docs/README.md)
- [`packages/schemas/docs/README.md`](../../../packages/schemas/docs/README.md)

## Environment

Fill `apps/server/.env.local` (gitignored). Do not commit secrets.

```env
DATABASE_URL=
FIREBASE_SERVICE_ACCOUNT_BASE64=
FIREBASE_WEB_API_KEY=
```

`FIREBASE_WEB_API_KEY` is the Web API key in Firebase Console → Project settings → General. Enable the Email/Password provider.

Register, login, refresh, and `/me` use that Web API key. Firebase Admin (`FIREBASE_SERVICE_ACCOUNT_BASE64`) is only required for custom claims and server-side refresh-token revocation. If Admin logs `invalid_grant` / JWT timeframe, check Windows clock sync with Google, or mint a new service-account key. Do not leave a trailing `%` on the base64 value.

Schema: apply [`docs/db/printkro_mvp_schema_v3.sql`](../../../docs/db/printkro_mvp_schema_v3.sql) if tables are missing, then [`docs/db/migrations/001_shop_user_firebase_auth.sql`](../../../docs/db/migrations/001_shop_user_firebase_auth.sql). From `apps/server` with `DATABASE_URL` in `.env.local`:

```bash
pnpm --filter server db:apply-auth
```

## Endpoints

All JSON. Errors: `{ "error": "message" }`.

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | none | `{ name, shopName, password, email?, phone? }` — email or phone required. Creates a shop + OWNER. `201` |
| POST | `/api/auth/login` | none | `{ identifier, password }` — identifier is email or phone |
| POST | `/api/auth/refresh` | none | `{ refreshToken }` |
| POST | `/api/auth/logout` | Bearer idToken | revokes Firebase refresh tokens |
| GET | `/api/auth/me` | Bearer idToken | current ACTIVE shop user |

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
- `503` `DATABASE_URL` or Firebase env not configured

## Code

- Routes: `app/api/auth/*/route.ts`
- Service: `src/modules/auth/auth.service.ts`
- Guard: `requireShopUser(idToken)` — verify Firebase ID token, load ACTIVE `shop_users` row
- DB: Drizzle models for `shops` and `shop_users` only (`src/db/`)
