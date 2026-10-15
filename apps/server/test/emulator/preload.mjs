// Loaded with `--import` before any emulator test. Refuses to run anywhere but the local emulators
// on a `demo-` project, and drops credentials so nothing can reach a real Firebase project or bucket.
import { register } from "node:module";

const project = process.env.GCLOUD_PROJECT ?? "";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Emulator tests need the Firestore and Auth emulators: run `pnpm --filter server test:emulator`.");
}
if (!project.startsWith("demo-")) {
  throw new Error(`Emulator tests only run on a demo- project, not "${project}".`);
}

for (const name of [
  "FIREBASE_SERVICE_ACCOUNT_BASE64",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
  // Doorbell rings are skipped without a database URL.
  "FIREBASE_DATABASE_URL",
  "FIRESTORE_OP_COUNTERS",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET_NAME",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
]) {
  delete process.env[name];
}
// Signs local download links; any value works.
process.env.FIREBASE_WEB_API_KEY = "emulator-test-key";

register("./loader.mjs", import.meta.url);
