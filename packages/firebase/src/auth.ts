import { getAuth, type Auth } from "firebase-admin/auth";

import { getFirebaseApp } from "./app.js";

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export {
  FIREBASE_PHONE_EMAIL_DOMAIN,
  FirebaseAuthRestError,
  isInternalPhoneEmail,
  looksLikeEmail,
  normalizePhoneNumber,
  phoneToFirebaseEmail,
  refreshIdToken,
  signInWithPassword,
  signUpWithPassword,
  type FirebasePasswordAuthResult,
} from "./auth-rest.js";
