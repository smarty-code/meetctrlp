# @ctrlp/schemas

Zod schemas for HTTP request and response validation. Domain TypeScript types live in `@ctrlp/types`; this package is the runtime contract.

## Auth

Import from `@ctrlp/schemas` or `@ctrlp/schemas/auth`.

- `registerRequestSchema` — shop owner sign-up. Requires `name`, `shopName`, `password`, and at least one of `email` or `phone`. Rejects the reserved Firebase phone-mapping domain `phone.meetctrlp.app`.
- `loginRequestSchema` — `{ identifier, password }`. `identifier` is an email or a phone number.
- `refreshRequestSchema` — `{ refreshToken }`.
- `authSessionResponseSchema` / `authMeResponseSchema` — documented response shapes for clients.

Parse untrusted JSON with these schemas in server route handlers before calling services.
