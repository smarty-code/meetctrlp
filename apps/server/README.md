## Server app

This is the backend Next.js application. It uses App Router route handlers for HTTP APIs and has no browser-facing page shell.

### Structure

- `app/api`: HTTP route handlers and API versioning boundaries.
- `src/config`: environment and application configuration.
- `src/lib`: shared infrastructure, HTTP helpers, and integrations.
- `src/modules`: domain-oriented features with their own services and types.
- `src/types`: shared server-only types.
- `src/utils`: small dependency-free utilities.

The initial test endpoint is `GET /api/health`.

Run it from the repository root:

```bash
pnpm run server:dev
curl http://localhost:3000/api/health
```
