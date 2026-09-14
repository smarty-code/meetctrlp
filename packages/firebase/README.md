# @ctrlp/firebase

Server-only adapters for Firebase Authentication, Firestore, and Railway S3-compatible Storage.

Firebase Admin remains the source for Authentication and Firestore. Object storage is provided by an S3-compatible client configured for Railway Storage Buckets.

## Configuration

Copy `.env.example` into the consuming server app's environment. Never commit populated environment files or credentials.

Firebase Admin uses Application Default Credentials when no explicit Firebase variables are set. Alternatively, provide all three explicit values:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

The adapter converts escaped `\\n` sequences into newlines before initializing Firebase Admin.

Railway S3 requires:

```env
S3_ENDPOINT=https://t3.storageapi.dev
S3_REGION=auto
S3_BUCKET_NAME=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
```

## Usage

```ts
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  getFirebaseAuth,
  getFirebaseFirestore,
} from "@ctrlp/firebase";

const auth = getFirebaseAuth();
const firestore = getFirebaseFirestore();
const uploadUrl = await createPresignedUploadUrl(
  "uploads/example.pdf",
  "application/pdf",
);
const downloadUrl = await createPresignedDownloadUrl("uploads/example.pdf");
```

The package initializes Firebase Admin lazily with one named app (`ctrlp`). Storage credentials and the S3 client are also loaded lazily. Presigned URLs default to one hour and should only be returned from authenticated backend routes after Firebase Auth token verification.

Never import this package into browser code. S3 credentials and Firebase Admin credentials must remain server-side.
