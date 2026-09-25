export type FirebaseConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

export type S3Config = {
  endpoint: string;
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type FirebaseServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function requireEnvironmentValue(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n");
}

function readOptionalEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function parseServiceAccountBase64(encoded: string): FirebaseConfig {
  let parsed: FirebaseServiceAccountJson;

  try {
    parsed = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    ) as FirebaseServiceAccountJson;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON",
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key
      ? normalizePrivateKey(parsed.private_key)
      : undefined,
  };
}

export function getFirebaseConfig(): FirebaseConfig {
  const encoded = readOptionalEnvironmentValue(
    "FIREBASE_SERVICE_ACCOUNT_BASE64",
  );

  if (encoded) {
    return parseServiceAccountBase64(encoded);
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
      : undefined,
  };
}

export function getFirebaseWebApiKey() {
  return requireEnvironmentValue("FIREBASE_WEB_API_KEY");
}

export function hasFirebaseCredentials(config: FirebaseConfig) {
  return Boolean(config.projectId || config.clientEmail || config.privateKey);
}

export function assertFirebaseCredentials(config: FirebaseConfig) {
  const missing = [
    ["FIREBASE_PROJECT_ID", config.projectId],
    ["FIREBASE_CLIENT_EMAIL", config.clientEmail],
    ["FIREBASE_PRIVATE_KEY", config.privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Firebase configuration is incomplete. Missing: ${missing.join(", ")}`,
    );
  }
}

export function getS3Config(): S3Config {
  return {
    endpoint: requireEnvironmentValue("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "auto",
    bucketName: requireEnvironmentValue("S3_BUCKET_NAME"),
    accessKeyId: requireEnvironmentValue("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnvironmentValue("S3_SECRET_ACCESS_KEY"),
  };
}
