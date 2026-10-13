# Object storage

Object storage is Railway S3-compatible storage, not Firebase Storage. Helpers live on `@ctrlp/firebase/storage`:

- `createPresignedUploadUrl` / `createPresignedDownloadUrl`
- `uploadObject` / `readObject` / `deleteObject`
- `getS3StorageClient` for operations the helpers do not cover

Requires `S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. `S3_REGION` defaults to `auto`.

In `apps/server`, Next.js loads `.env.local` over `.env`. Keep S3 variables in sync when you rotate Railway bucket credentials.

Presigned upload URLs are opened in the browser (XHR `PUT`). The S3 client disables automatic request checksums so presigned URLs do not require `x-amz-checksum-*` headers the browser cannot send.
