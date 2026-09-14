export type FirebaseConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  storageBucket?: string;
};

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  storage_bucket?: string;
};

function normalizePrivateKey(privateKey?: string) {
  return privateKey?.replace(/\\n/g, "\n");
}

function getServiceAccountFromBase64(): FirebaseConfig | undefined {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (!encoded) {
    return undefined;
  }

  let serviceAccount: FirebaseServiceAccount;

  try {
    serviceAccount = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_BASE64 must be valid base64-encoded JSON.",
    );
  }

  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: normalizePrivateKey(serviceAccount.private_key),
    storageBucket: serviceAccount.storage_bucket,
  };
}

export function getFirebaseConfig(): FirebaseConfig {
  const serviceAccountConfig = getServiceAccountFromBase64();

  return {
    ...(serviceAccountConfig ?? {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ?? serviceAccountConfig?.storageBucket,
  };
}

export function hasExplicitCredentials(config: FirebaseConfig) {
  return Boolean(config.projectId || config.clientEmail || config.privateKey);
}

export function assertExplicitCredentials(config: FirebaseConfig) {
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
