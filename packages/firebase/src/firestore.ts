import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { getFirebaseApp } from "./app";

export function getFirebaseFirestore(): Firestore {
  return getFirestore(getFirebaseApp());
}
