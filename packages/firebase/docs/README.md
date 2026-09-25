# @ctrlp/firebase

Server-only adapters for Firebase Authentication, Firestore, and Railway S3-compatible object storage.

These packages export TypeScript source (`exports` point at `.ts` files). Next.js transpiles them, so relative imports inside the package must be extensionless (`./auth`), not NodeNext `./auth.js`.

## Environment

Prefer a base64-encoded service account JSON. Fall back to discrete Admin fields. Password sign-in also needs the Firebase **Web API key** (not present in the service-account JSON).

```env
FIREBASE_SERVICE_ACCOUNT_BASE64=
FIREBASE_WEB_API_KEY=

# Fallback when FIREBASE_SERVICE_ACCOUNT_BASE64 is unset
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

`FIREBASE_PRIVATE_KEY` may contain escaped `\n` sequences; they are normalized before Admin init.

See [docs/AUTH.md](./AUTH.md) for the shop-owner password flow and [docs/STORAGE.md](./STORAGE.md) for S3 helpers.

## Exports

```ts
import { getFirebaseAuth, signInWithPassword } from "@ctrlp/firebase";
import { getFirebaseAuth } from "@ctrlp/firebase/auth";
import { signUpWithPassword } from "@ctrlp/firebase/auth-rest";
import { getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import { createPresignedUploadUrl } from "@ctrlp/firebase/storage";
```
