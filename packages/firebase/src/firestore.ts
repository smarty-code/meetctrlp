import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { getFirebaseApp } from "./app.js";

export function getFirebaseFirestore(): Firestore {
  return getFirestore(getFirebaseApp());
}
