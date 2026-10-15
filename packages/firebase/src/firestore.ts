import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type Firestore,
  type Timestamp,
  type Transaction,
} from "firebase-admin/firestore";

import { getFirebaseApp } from "./app";
import { installFirestoreOpCounters } from "./op-counters";

export { FieldValue, type DocumentReference, type Timestamp, type Transaction };

export function getFirebaseFirestore(): Firestore {
  if (process.env.FIRESTORE_OP_COUNTERS === "1") {
    installFirestoreOpCounters();
  }

  return getFirestore(getFirebaseApp());
}
