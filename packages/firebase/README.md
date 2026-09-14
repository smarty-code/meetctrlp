# @ctrlp/firebase

Server-only adapters for Firebase Authentication, Firestore, and Railway S3-compatible Storage.

Firebase Admin remains the source for Authentication and Firestore. Object storage is provided by an S3-compatible client configured for Railway Storage Buckets.

## Configuration

Copy `.env.example` into the consuming server app's environment. Never commit populated environment files or credentials.

Required S3 variables:

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
const uploadUrl = await createPresignedUploadUrl("uploads/example.pdf", "application/pdf");
const downloadUrl = await createPresignedDownloadUrl("uploads/example.pdf");
```

Storage credentials are loaded lazily when an S3 method is called. Presigned URLs default to one hour and should only be returned from authenticated backend routes after Firebase Auth token verification.
