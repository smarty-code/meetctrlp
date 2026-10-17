import type { CSSProperties } from "react"

/** Inline style that sets an element's stagger index (`--i`) for entrance animations (PRD 4.7). */
export function stagger(index: number): CSSProperties {
  return { "--i": index } as CSSProperties
}
