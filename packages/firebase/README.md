# @ctrlp/firebase

Server-only Firebase Admin adapters for CtrlP.

The package exposes lazy accessors for:

- Firebase Authentication through `getFirebaseAuth()`
- Cloud Firestore through `getFirebaseFirestore()`
- Cloud Storage through `getFirebaseStorageBucket()`

## Configuration

Set `FIREBASE_SERVICE_ACCOUNT_BASE64` to the base64-encoded contents of the Firebase service-account JSON. This is the primary configuration source:

```env
FIREBASE_SERVICE_ACCOUNT_BASE64=base64-encoded-service-account-json
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
```

Application Default Credentials are used when neither the base64 JSON nor individual credentials are present. As a fallback, provide the individual service-account values:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
```

Never commit a real service-account JSON, private key, base64 credential, or populated `.env` file.

The package initializes one named Firebase Admin app (`ctrlp`) on first access. Importing the package alone does not initialize Firebase.

```ts
import {
  getFirebaseAuth,
  getFirebaseFirestore,
  getFirebaseStorageBucket,
} from "@ctrlp/firebase";

const auth = getFirebaseAuth();
const firestore = getFirebaseFirestore();
const storage = getFirebaseStorageBucket();
```
