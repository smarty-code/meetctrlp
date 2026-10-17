/**
 * In-memory fixed-window limiter: 5 requests per hour per IP (PRD 5.12).
 * Per server instance only. TODO(owner): move to a shared store (for example Vercel KV)
 * if the site runs on many instances.
 */
export const rateLimit = { max: 5, windowMs: 60 * 60 * 1000 } as const

const hits = new Map<string, { count: number; resetAt: number }>()

export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || headers.get("x-real-ip") || "unknown"
}

export function allowRequest(key: string, now: number = Date.now()): boolean {
  const entry = hits.get(key)
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + rateLimit.windowMs })
    return true
  }
  if (entry.count >= rateLimit.max) return false
  entry.count += 1
  return true
}

export function resetRateLimit(): void {
  hits.clear()
}
