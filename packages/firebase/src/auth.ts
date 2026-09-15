import { getAuth, type Auth } from "firebase-admin/auth";

import { getFirebaseApp } from "./app.js";

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
