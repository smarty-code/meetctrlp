import { getStorage, type Storage } from "firebase-admin/storage";

import { getFirebaseApp } from "./app.js";

export type FirebaseStorageBucket = ReturnType<Storage["bucket"]>;

export function getFirebaseStorageBucket(): FirebaseStorageBucket {
  return getStorage(getFirebaseApp()).bucket();
}
