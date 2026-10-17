/**
 * Dual-layer vertical text roll: on hover of the nearest `group` ancestor the label slides up
 * and an identical copy rolls in from below. The copy is hidden from assistive tech.
 */
export function RollText({ label }: { label: string }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <span className="transition-transform duration-300 ease-out group-hover:-translate-y-full group-focus-visible:-translate-y-full">
        {label}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0 group-focus-visible:translate-y-0"
      >
        {label}
      </span>
    </span>
  )
}
