# @ctrlp/types

Shared TypeScript domain types. This package has no runtime dependencies.

## Auth

Shop-owner authentication types live in `@ctrlp/types/auth` and are re-exported from the package root.

- `ShopUser` / `AuthSessionUser` — Postgres shop user as returned to clients. Never includes `password_hash` or the internal Firebase phone-mapping email.
- `AuthTokens` — Firebase `idToken`, `refreshToken`, and `expiresIn` (seconds).
- `AuthSessionResponse` — login/register/refresh body.
- `RegisterRequest`, `LoginRequest`, `RefreshRequest` — request shapes. Runtime validation belongs in `@ctrlp/schemas`, not here.

Shop users are the desktop/shop identities. Print users (guest QR sessions) are a different table and are not covered here.
