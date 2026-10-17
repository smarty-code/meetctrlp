import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Security & Content Security Policy (CSP) Edge Middleware
 * Governed by PRD Section 9.7
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const isDev = process.env.NODE_ENV === "development"

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://plausible.io ${isDev ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https: blob:;
    font-src 'self' https://fonts.gstatic.com data:;
    connect-src 'self' https://api.resend.com https://plausible.io;
    frame-ancestors 'none';
    form-action 'self';
    base-uri 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim()

  const response = NextResponse.next()

  response.headers.set("Content-Security-Policy", cspHeader)
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|art/).*)"],
}
