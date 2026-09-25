export { getFirebaseApp } from "./app.js";
export {
  assertFirebaseCredentials,
  getFirebaseConfig,
  getFirebaseWebApiKey,
  getS3Config,
  hasFirebaseCredentials,
  type FirebaseConfig,
  type S3Config,
} from "./config.js";
export {
  FIREBASE_PHONE_EMAIL_DOMAIN,
  FirebaseAuthRestError,
  getFirebaseAuth,
  isInternalPhoneEmail,
  looksLikeEmail,
  normalizePhoneNumber,
  phoneToFirebaseEmail,
  refreshIdToken,
  signInWithPassword,
  signUpWithPassword,
  type FirebasePasswordAuthResult,
} from "./auth.js";
export { getFirebaseFirestore } from "./firestore.js";
export {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteObject,
  getS3StorageClient,
  uploadObject,
} from "./storage.js";
