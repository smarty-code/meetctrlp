import { getAuth, type Auth } from "firebase-admin/auth";

import { getFirebaseApp } from "./app";

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/**
 * Signs a custom token for a guest (uid = printUserId) so the tracking page can sign in and read its
 * own `orderTracking` documents. Signed locally with the service account key; no claims needed.
 */
export function createCustomToken(uid: string): Promise<string> {
  return getFirebaseAuth().createCustomToken(uid);
}

export {
  FIREBASE_PHONE_EMAIL_DOMAIN,
  FirebaseAuthRestError,
  isInternalPhoneEmail,
  looksLikeEmail,
  normalizePhoneNumber,
  lookupIdToken,
  phoneToFirebaseEmail,
  refreshIdToken,
  signInWithPassword,
  signUpWithPassword,
  type FirebasePasswordAuthResult,
} from "./auth-rest";
