# Object storage

Object storage is Railway S3-compatible storage, not Firebase Storage. Helpers live on `@ctrlp/firebase/storage`:

- `createPresignedUploadUrl` / `createPresignedDownloadUrl`
- `uploadObject` / `deleteObject`
- `getS3StorageClient` for operations the helpers do not cover

Requires `S3_ENDPOINT`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. `S3_REGION` defaults to `auto`.
