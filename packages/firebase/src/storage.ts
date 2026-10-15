import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getS3Config } from "./config";

let s3Client: S3Client | undefined;
let s3ClientConfigKey: string | undefined;

function requireObjectKey(key: string) {
  if (!key.trim()) {
    throw new Error("An object key is required.");
  }

  return key;
}

function getClientAndConfig() {
  const config = getS3Config();
  const configKey = `${config.endpoint}|${config.bucketName}|${config.accessKeyId}|${config.region}`;

  if (!s3Client || s3ClientConfigKey !== configKey) {
    s3ClientConfigKey = configKey;
    s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      // Default SDK checksums embed x-amz-checksum-* in presigned URLs; browsers cannot send those headers on XHR PUT.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return { client: s3Client, config };
}

export function getS3StorageClient() {
  return getClientAndConfig().client;
}

export async function createPresignedUploadUrl(
  key: string,
  contentType?: string,
  expiresIn = 3600,
) {
  const { client, config } = getClientAndConfig();
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: requireObjectKey(key),
    ...(contentType ? { ContentType: contentType } : {}),
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function createPresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
) {
  const { client, config } = getClientAndConfig();
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: requireObjectKey(key),
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function readObject(key: string): Promise<Uint8Array> {
  const { client, config } = getClientAndConfig();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: requireObjectKey(key),
    }),
  );

  if (!response.Body) {
    throw new Error("Object body is empty.");
  }

  return response.Body.transformToByteArray();
}

/** The stored object's size in bytes, read without downloading it. */
export async function getObjectSize(key: string) {
  const { client, config } = getClientAndConfig();
  const response = await client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: requireObjectKey(key),
    }),
  );

  return response.ContentLength ?? 0;
}

/** True when a storage call failed because the object does not exist, not because storage was unreachable. */
export function isMissingObjectError(error: unknown) {
  const record = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return (
    record?.$metadata?.httpStatusCode === 404 ||
    record?.name === "NotFound" ||
    record?.name === "NoSuchKey"
  );
}

export async function uploadObject(
  key: string,
  body: Uint8Array | string,
  contentType?: string,
) {
  const { client, config } = getClientAndConfig();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: requireObjectKey(key),
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
  );
}

export async function deleteObject(key: string) {
  const { client, config } = getClientAndConfig();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: requireObjectKey(key),
    }),
  );
}
