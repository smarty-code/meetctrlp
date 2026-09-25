import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getS3Config } from "./config";

let s3Client: S3Client | undefined;

function requireObjectKey(key: string) {
  if (!key.trim()) {
    throw new Error("An object key is required.");
  }

  return key;
}

function getClientAndConfig() {
  const config = getS3Config();

  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
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
