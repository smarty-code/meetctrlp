/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_BASE_URL?: string
  /** Firebase Web API key, passed to the agent for the Secure Token API. */
  readonly VITE_FIREBASE_API_KEY?: string
  /** Realtime Database URL of the shop doorbell, passed to the agent. */
  readonly VITE_FIREBASE_DATABASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
