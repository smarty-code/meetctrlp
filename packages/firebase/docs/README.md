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

## Security rules and indexes

The deployed rules and indexes are in this package, wired up by the repo-root `firebase.json`:

| File | What it holds |
| --- | --- |
| `firestore.rules` | Clients can only `get` their own `orderTracking/{orderId}`; everything else is server-only |
| `database.rules.json` | A shop user can read only `/doorbell/{shopId}` for their own `shopId` claim; no client writes |
| `firestore.indexes.json` | Composite indexes for agent `sync`, the board, history and search |
| `test/rules.test.ts` | Rules tests: `pnpm firebase:rules:test` from the repo root (needs JDK 21+ for the emulators; runs under the `demo-ctrlp-rules` project, never a real one) |

Deploy indexes first and wait for them to build, then the rules: `pnpm firebase:deploy:indexes`, then `pnpm firebase:deploy:rules`. Background: `docs/arc/TRAFFIC_SCALING_V2_IMPLEMENTATION.md` section 7.

## Exports

```ts
import { getFirebaseAuth, signInWithPassword } from "@ctrlp/firebase";
import { getFirebaseAuth } from "@ctrlp/firebase/auth";
import { signUpWithPassword } from "@ctrlp/firebase/auth-rest";
import { getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import { createPresignedUploadUrl } from "@ctrlp/firebase/storage";
```
