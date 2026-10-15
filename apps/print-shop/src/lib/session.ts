import { getAgentIdToken, isTauriRuntime } from "./agent"
import { configureCloudAuth } from "./cloud"

// Where API calls get their bearer token (implementation plan 8.2). The agent owns this PC's login,
// so the window asks it each time; the agent answers from its cache. Right after a login, before
// the agent has the session, the login's own token is used ("the seed").

const REFRESH_MARGIN_MS = 60_000

let seed: { token: string; expiresAt: number } | null = null
let signedOut: () => void = () => undefined

/** Holds a fresh login's ID token until `cloud.session` hands it to the agent. */
export function seedLoginToken(token: string, expiresInSeconds: number) {
  seed = { token, expiresAt: Date.now() + expiresInSeconds * 1000 }
  return seed
}

export function clearLoginToken() {
  seed = null
}

/** Called when the login is gone (a 401 after a refresh, or the agent reports an invalid token). */
export function onSignedOut(handler: () => void) {
  signedOut = handler
}

configureCloudAuth(
  async (forceRefresh) => {
    if (!forceRefresh && seed && seed.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
      return seed.token
    }
    if (isTauriRuntime()) {
      const token = await getAgentIdToken(forceRefresh)
      return token.signedIn ? (token.idToken ?? null) : null
    }
    // Browser preview: no agent, so only the login's token.
    return seed?.token ?? null
  },
  () => signedOut()
)
