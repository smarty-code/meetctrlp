# Firebase Authentication

Firebase owns passwords and session tokens. `@ctrlp/firebase` exposes two surfaces:

1. **Admin SDK** (`getFirebaseAuth()`) — verify ID tokens, update users, set custom claims, revoke refresh tokens, delete users.
2. **Identity Toolkit REST** — `signUpWithPassword`, `signInWithPassword`, `refreshIdToken`. Admin cannot check a password; these calls use `FIREBASE_WEB_API_KEY`.

The desktop app must not use a Firebase client SDK. It sends email/phone + password to `apps/server`, which calls these helpers.

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

```ts
import { getFirebaseAuth } from "@ctrlp/firebase/auth";

const decoded = await getFirebaseAuth().verifyIdToken(idToken);
```

Do not trust a client-supplied uid until this succeeds.
