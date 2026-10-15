# Object storage

Object storage is Railway S3-compatible storage, not Firebase Storage. Helpers live on `@ctrlp/firebase/storage`:

- `createPresignedUploadUrl` / `createPresignedDownloadUrl`
- `uploadObject` / `readObject` / `deleteObject`
- `getObjectSize`: the object's size in bytes from a `HEAD` request, without downloading it. Check it before `readObject` on anything a client uploaded, because a presigned `PUT` doesn't limit the body size.
- `isMissingObjectError`: true when a storage call failed because the object doesn't exist (404, `NotFound`, `NoSuchKey`), not because storage was unreachable. Use it to tell a client error (400) from a retryable failure.
- `getS3StorageClient` for operations the helpers do not cover

Requires `S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. `S3_REGION` defaults to `auto`.

In `apps/server`, Next.js loads `.env.local` over `.env`; in production the values come from App Hosting secrets ([`docs/deploy/ENVIRONMENT.md`](../../../docs/deploy/ENVIRONMENT.md)). When you rotate the Railway bucket credentials, update both. Browser uploads also need a CORS rule on the bucket for the web app's origin (deploy guide step 8).

Presigned upload URLs are opened in the browser (XHR `PUT`). The S3 client disables automatic request checksums so presigned URLs do not require `x-amz-checksum-*` headers the browser cannot send.

`readObject` loads the whole object into memory. On Firebase App Hosting that memory is shared with every request on the instance, so check the size first with `getObjectSize`, and wrap the result with `Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)` rather than `Buffer.from(bytes)`, which copies it. See [`apps/server/docs/deployment.md`](../../../apps/server/docs/deployment.md).
