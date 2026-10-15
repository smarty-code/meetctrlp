export { getFirebaseApp } from "./app";
export {
  assertFirebaseCredentials,
  getFirebaseConfig,
  getFirebaseWebApiKey,
  getS3Config,
  hasFirebaseCredentials,
  type FirebaseConfig,
  type S3Config,
} from "./config";
export {
  FIREBASE_PHONE_EMAIL_DOMAIN,
  FirebaseAuthRestError,
  getFirebaseAuth,
  isInternalPhoneEmail,
  looksLikeEmail,
  normalizePhoneNumber,
  lookupIdToken,
  phoneToFirebaseEmail,
  refreshIdToken,
  signInWithPassword,
  signUpWithPassword,
  type FirebasePasswordAuthResult,
} from "./auth";
export { getFirebaseFirestore } from "./firestore";
export {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteObject,
  getObjectSize,
  getS3StorageClient,
  isMissingObjectError,
  readObject,
  uploadObject,
} from "./storage";
