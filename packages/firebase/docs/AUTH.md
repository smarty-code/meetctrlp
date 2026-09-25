# Firebase Authentication

Firebase owns passwords and session tokens. `@ctrlp/firebase` exposes two surfaces:

1. **Admin SDK** (`getFirebaseAuth()`) — verify ID tokens, update users, set custom claims, revoke refresh tokens, delete users.
2. **Identity Toolkit REST** — `signUpWithPassword`, `signInWithPassword`, `refreshIdToken`, `lookupIdToken`. Password checks and ID-token lookup use `FIREBASE_WEB_API_KEY`. Admin is optional for custom claims and token revocation.

The desktop app must not use a Firebase client SDK. It sends email/phone + password to `apps/server`, which calls these helpers.

Shop-owner register/login/me/refresh go through REST so they keep working if the Admin service-account JWT cannot be minted (`invalid_grant` / clock skew / revoked key). Phone numbers are stored in Postgres; they are not written onto the Firebase user via Admin.

## Phone + password

Firebase password accounts always use an email. Phone-only shop owners get a stable internal address:

`{digits}@phone.meetctrlp.app`

Never return that address to clients. Reject it if a user tries to register it as a real email.

Helpers:

- `normalizePhoneNumber` — E.164; 10-digit numbers become `+91…`
- `phoneToFirebaseEmail`
- `isInternalPhoneEmail`
- `looksLikeEmail`

When a shop user also has a real email, sign-in with phone must look up that email in Postgres, then call `signInWithPassword`.

## Sign-up / sign-in result

```ts
{
  idToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  localId: string;   // Firebase uid
  email: string;
}
```

`FirebaseAuthRestError.code` is the Identity Toolkit message prefix (`EMAIL_EXISTS`, `EMAIL_NOT_FOUND`, `INVALID_PASSWORD`, `INVALID_REFRESH_TOKEN`, …).

## Token verification

Prefer Identity Toolkit lookup (same Web API key as password sign-in):

```ts
import { lookupIdToken } from "@ctrlp/firebase/auth";

const { localId } = await lookupIdToken(idToken);
```

`getFirebaseAuth().verifyIdToken(idToken)` still works when Admin credentials are valid. Do not trust a client-supplied uid until lookup or Admin verification succeeds.

If Admin fails with `invalid_grant` / `app/invalid-credential`, the machine clock may be more than ~60 minutes off Google, or the service-account key was revoked. Password auth via `FIREBASE_WEB_API_KEY` is unaffected.
