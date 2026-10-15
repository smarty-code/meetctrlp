// Loaded with a dynamic import() from the tracking page only, so other pages don't ship the SDK
// (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 11.1). The guest signs in with the custom token from the
// session start and reads one document: orderTracking/{orderId}.
import { getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { browserSessionPersistence, getAuth, setPersistence, signInWithCustomToken } from "firebase/auth"
import {
  doc,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  type DocumentData,
  type Firestore,
} from "firebase/firestore"

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let db: Firestore | null = null

/** False when the build has no Firebase config; the page then fetches once instead of listening. */
export function trackingListenerAvailable() {
  return Boolean(config.apiKey && config.projectId && config.appId)
}

function firebase() {
  if (!app) {
    app = getApps()[0] ?? initializeApp(config)
    try {
      // No persistent cache: a guest's order needn't outlive the tab.
      db = initializeFirestore(app, { localCache: memoryLocalCache() })
    } catch {
      db = getFirestore(app)
    }
  }
  return { app, db: db! }
}

/** Signs this tab in as the guest (uid = printUserId). Ends with the tab, never in local storage. */
export async function signInGuest(firebaseToken: string) {
  const auth = getAuth(firebase().app)
  await setPersistence(auth, browserSessionPersistence)
  await signInWithCustomToken(auth, firebaseToken)
}

/** Calls `onData` with the tracking copy now and on every change. Returns the function that stops it. */
export function watchOrderTracking(
  orderId: string,
  onData: (data: DocumentData | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(firebase().db, "orderTracking", orderId),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() : null),
    onError,
  )
}
