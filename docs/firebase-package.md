# Firebase and S3 Package

`@ctrlp/firebase` is a server-only adapter package for:

- Firebase Authentication
- Cloud Firestore
- Railway Storage Buckets through the S3-compatible API

Firebase remains responsible for Authentication and Firestore. Railway S3 is the object-storage provider. The package must only be imported from backend code, route handlers, server actions, workers, or other trusted server environments.

Do not import it into browser components. S3 credentials and Firebase Admin credentials must never be sent to a client.

## Installation

From the repository root, add the workspace package to the consuming backend app:

```bash
pnpm --filter server add @ctrlp/firebase@workspace:*
```

For another workspace package, replace `server` with that package's name.

## Environment

Create an ignored `.env` or `.env.local` file in the consuming server application. Do not commit it.

### Firebase Authentication and Firestore

Use either Application Default Credentials or all three explicit Firebase Admin values:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-firebase-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

The adapter converts escaped `\\n` sequences in `FIREBASE_PRIVATE_KEY` into newlines before initializing Firebase Admin.

### Railway S3 Storage

```env
S3_ENDPOINT=https://t3.storageapi.dev
S3_REGION=auto
S3_BUCKET_NAME=your-railway-bucket-name
S3_ACCESS_KEY_ID=your-railway-access-key
S3_SECRET_ACCESS_KEY=your-railway-secret-key
```

The S3 client is created lazily when the first storage function is called. `S3_REGION` defaults to `auto`, but keeping it explicit makes deployment configuration easier to inspect.

## Package exports

The package root exports all supported adapters:

```ts
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteObject,
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseFirestore,
  getS3StorageClient,
  uploadObject,
} from "@ctrlp/firebase";
```

Subpath exports are also available:

```ts
import { getFirebaseAuth } from "@ctrlp/firebase/auth";
import { getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import { createPresignedUploadUrl } from "@ctrlp/firebase/storage";
```

## Firebase Authentication

`getFirebaseAuth()` returns the Firebase Admin `Auth` instance. Use it to verify Firebase ID tokens and manage users from trusted server code.

### Verify a client ID token

A backend route should receive a bearer token from the client, verify it, and then use the decoded identity for authorization:

```ts
import { getFirebaseAuth } from "@ctrlp/firebase";

export async function requireUser(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;

  if (!token) {
    throw new Error("Missing bearer token");
  }

  return getFirebaseAuth().verifyIdToken(token);
}
```

Do not treat a client-supplied user ID as authenticated until the ID token has been verified. In a real route, translate authentication failures into an HTTP `401` response.

### Manage users

The returned Admin Auth instance exposes the standard Firebase Admin methods:

```ts
import { getFirebaseAuth } from "@ctrlp/firebase";

const auth = getFirebaseAuth();
const user = await auth.getUser(uid);
await auth.setCustomUserClaims(user.uid, { role: "operator" });
```

Custom claims should be assigned only by trusted backend code and should be used together with server-side authorization checks.

## Firestore

`getFirebaseFirestore()` returns the Firebase Admin `Firestore` instance. Use the normal Admin SDK API for reads, writes, transactions, and batched writes.

```ts
import { getFirebaseFirestore } from "@ctrlp/firebase";

const firestore = getFirebaseFirestore();

await firestore.collection("users").doc(uid).set(
  {
    displayName: "Example User",
    updatedAt: new Date(),
  },
  { merge: true },
);

const snapshot = await firestore
  .collection("users")
  .doc(uid)
  .get();

const user = snapshot.exists ? snapshot.data() : undefined;
```

Keep authorization decisions in backend services. Firestore Admin SDK calls bypass client-side Firestore Security Rules because they run with service-account privileges.

### Transactions and batches

Use a transaction when multiple reads and writes must be consistent:

```ts
const result = await firestore.runTransaction(async (transaction) => {
  const ref = firestore.collection("orders").doc(orderId);
  const snapshot = await transaction.get(ref);

  if (!snapshot.exists) {
    throw new Error("Order not found");
  }

  const order = snapshot.data() as { status: string };
  transaction.update(ref, {
    status: "processed",
    processedAt: new Date(),
  });

  return order;
});
```

## Railway S3 Storage

Railway Storage Buckets expose an S3-compatible API. The package provides a configured S3 client plus common object operations.

### Presigned upload URL

Use a backend route to authorize the upload and return a short-lived URL to the client:

```ts
import { createPresignedUploadUrl } from "@ctrlp/firebase";

const objectKey = `uploads/${userId}/${crypto.randomUUID()}.pdf`;
const uploadUrl = await createPresignedUploadUrl(
  objectKey,
  "application/pdf",
  900,
);

return Response.json({ objectKey, uploadUrl });
```

The client can then upload directly to Railway:

```ts
await fetch(uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": "application/pdf" },
  body: file,
});
```

The `Content-Type` used by the client must match the content type used when generating the URL.

### Presigned download URL

Generate a temporary download URL only after checking that the requesting user can access the object:

```ts
import { createPresignedDownloadUrl } from "@ctrlp/firebase";

const downloadUrl = await createPresignedDownloadUrl(objectKey, 900);
return Response.json({ downloadUrl });
```

Presigned URLs are bearer credentials for their lifetime. Keep expiration times short and do not store them in Firestore as permanent file references. Store the stable S3 object key instead.

### Server-side upload

Use `uploadObject` when the backend already owns the file bytes:

```ts
import { uploadObject } from "@ctrlp/firebase";

await uploadObject(
  "system/exports/report.json",
  JSON.stringify({ generatedAt: new Date().toISOString() }),
  "application/json",
);
```

### Delete an object

```ts
import { deleteObject } from "@ctrlp/firebase";

await deleteObject(objectKey);
```

### Raw S3 client

Use `getS3StorageClient()` only when the adapter helpers do not cover a required S3 operation. The returned client is configured for the Railway endpoint and bucket configuration is available through `getS3Config()`.

The command classes are an advanced escape hatch. Add the S3 client package to the consuming workspace package before using them directly:

```bash
pnpm --filter server add @aws-sdk/client-s3
```

```ts
import {
  DeleteObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getS3StorageClient, getS3Config } from "@ctrlp/firebase";

const client: S3Client = getS3StorageClient();
const { bucketName } = getS3Config();

await client.send(
  new DeleteObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  }),
);
```

## Recommended request flow

For an authenticated file upload:

1. The client signs in with Firebase Authentication.
2. The client sends its Firebase ID token to a backend route.
3. The backend verifies the token with `getFirebaseAuth().verifyIdToken()`.
4. The backend checks the user's authorization and creates an object key.
5. The backend returns a short-lived `createPresignedUploadUrl()` result.
6. The client uploads directly to Railway using `PUT`.
7. The backend stores the stable object key and metadata in Firestore.
8. For downloads, the backend repeats token verification and authorization before issuing a short-lived download URL.

## Validation

Typecheck the package from the repository root:

```bash
pnpm run firebase:typecheck
```

Run all workspace typechecks:

```bash
pnpm run typecheck:all
```
