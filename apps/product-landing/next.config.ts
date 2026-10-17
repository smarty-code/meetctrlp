import type { NextConfig } from "next"
import { validatePublicEnv } from "./src/config/env.schema"

// Fail `next build` / `next start` on a missing or malformed public variable (PRD 9.3).
validatePublicEnv(process.env)

/**
 * Security headers (PRD 9.8). The page is statically generated, so the CSP allows inline
 * scripts instead of a per-request nonce (a nonce would force dynamic rendering).
 * TODO(owner): move to a nonce-based CSP if the site ever renders dynamically.
 */
// React's dev build needs eval for debugging callstacks; production never does.
const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devEval} https://plausible.io`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://plausible.io",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
