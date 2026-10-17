import { claims, type ClaimKey } from "@/content/claims"
import type { GatedText } from "@/types/content"

export function isVerified(key: ClaimKey): boolean {
  return claims[key].verified
}

/** The registry text when verified, otherwise its registry fallback (or null). */
export function resolveClaim(key: ClaimKey): string | null {
  const claim = claims[key]
  return claim.verified ? claim.text : claim.fallback
}

/** Resolve a section's gated copy: its own text when the claim holds, else its own fallback, else nothing. */
export function resolveGated(item: GatedText): string | null {
  if (item.claim === undefined || isVerified(item.claim)) return item.text
  return item.fallback ?? null
}

/** Keep only items whose gated text resolves, with the resolved text attached. */
export function resolveGatedList<T extends GatedText>(
  items: readonly T[]
): Array<T & { resolved: string }> {
  return items.flatMap((item) => {
    const resolved = resolveGated(item)
    return resolved === null ? [] : [{ ...item, resolved }]
  })
}
