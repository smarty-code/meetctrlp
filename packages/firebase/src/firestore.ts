import { FieldValue, getFirestore, type Firestore, type Timestamp } from "firebase-admin/firestore";

import { getFirebaseApp } from "./app";

export { FieldValue, type Timestamp };

export function getFirebaseFirestore(): Firestore {
  return getFirestore(getFirebaseApp());
}
