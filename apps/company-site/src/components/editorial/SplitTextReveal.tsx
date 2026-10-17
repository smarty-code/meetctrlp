import type { CSSProperties } from "react"

type SplitTextRevealProps = {
  text: string
  /** Delay before the first character, in ms. */
  baseDelayMs?: number
  /** Gap between characters, in ms. */
  stepMs?: number
  className?: string
}

/**
 * Staggered per-character entrance for display headings. The visible characters are
 * aria-hidden and the whole string is exposed once, so screen readers read a word, not letters.
 */
export function SplitTextReveal({ text, baseDelayMs = 0, stepMs = 25, className }: SplitTextRevealProps) {
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((char, index) => (
          <span
            key={`${char}-${index}`}
            className="char-in"
            style={{ "--delay": `${baseDelayMs + index * stepMs}ms` } as CSSProperties}
          >
            {char === " " ? " " : char}
          </span>
        ))}
      </span>
    </span>
  )
}
