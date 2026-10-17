import type { ClaimKey } from "@/content/claims"
import type { SectionId } from "@/config/routes"

/**
 * A display headline with one emphasised word or phrase (PRD 4.4, type device 1).
 * `breakBefore` adds a desktop-only line break before the emphasis (type device 3).
 */
export type Headline = {
  readonly lead: string
  readonly emphasis: string
  readonly tail?: string
  readonly breakBefore?: boolean
}

/** Text that depends on a product claim. Unverified → `fallback`, or nothing when absent. */
export type GatedText = {
  readonly text: string
  readonly claim?: ClaimKey
  readonly fallback?: string
}

/** A short bold label followed by a sentence, for example "Online payment. Confirmed before you print." */
export type LabelledLine = {
  readonly label: string
  readonly text: string
}

export type NavLink = {
  readonly label: string
  readonly target: SectionId
}

export type ExternalLink = {
  readonly label: string
  readonly href: string
}

export type SectionIntro = {
  readonly eyebrow: string
  readonly headline: Headline
  readonly intro?: string
}
