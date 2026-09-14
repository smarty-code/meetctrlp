export { getFirebaseApp } from "./app.js";
export {
  assertFirebaseCredentials,
  getFirebaseConfig,
  getS3Config,
  hasFirebaseCredentials,
  type FirebaseConfig,
  type S3Config,
} from "./config.js";
export { getFirebaseAuth } from "./auth.js";
export { getFirebaseFirestore } from "./firestore.js";
export {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteObject,
  getS3StorageClient,
  uploadObject,
} from "./storage.js";
