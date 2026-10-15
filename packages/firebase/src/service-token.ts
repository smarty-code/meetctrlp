import { getFirebaseApp } from "./app";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cached: { token: string; expiresAt: number } | undefined;
let pending: Promise<string> | undefined;

/**
 * An OAuth access token for the Admin credential, for Google REST APIs the Admin SDK doesn't wrap,
 * such as Realtime Database REST writes. Its scopes include `firebase.database` and
 * `userinfo.email`. Cached until 5 minutes before it expires; concurrent callers share one fetch.
 */
export async function getServiceAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return cached.token;
  }

  pending ??= (async () => {
    try {
      const credential = getFirebaseApp().options.credential;

      if (!credential) {
        throw new Error("Firebase Admin has no credential to mint access tokens");
      }

      const result = await credential.getAccessToken();
      cached = { token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
      return cached.token;
    } finally {
      pending = undefined;
    }
  })();

  return pending;
}
