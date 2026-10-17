/** Dot-matrix band behind the central card, faded into the page on every side. */
export function HalftoneBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`halftone rise-in pointer-events-none absolute inset-x-0 top-0 h-[520px] ${className}`}
    />
  )
}

/**
 * Soft organic framing art for the viewport edges (md and up). Lime hills and a sprig,
 * drifting slowly; decorative only and kept clear of the reading column.
 */
export function EdgeAccent({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left"
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute hidden md:block select-none w-[220px] lg:w-[300px] ${
        isLeft ? "left-0 top-12 -translate-x-1/4" : "right-0 bottom-0 translate-x-1/4"
      }`}
    >
      <svg viewBox="0 0 300 400" fill="none" className={`drift w-full h-auto ${isLeft ? "" : "-scale-x-100"}`}>
        <ellipse cx="150" cy="290" rx="150" ry="70" fill="var(--color-lime-soft)" opacity="0.9" />
        <ellipse cx="190" cy="320" rx="120" ry="52" fill="var(--color-hills-mid)" opacity="0.7" />
        <path
          d="M120 300C118 230 128 170 160 110"
          stroke="var(--color-lime-deep)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path d="M128 230C100 214 86 190 88 166C114 176 128 198 128 230Z" fill="var(--color-lime)" opacity="0.55" />
        <path d="M140 180C166 166 182 142 182 118C156 126 140 150 140 180Z" fill="var(--color-lime)" opacity="0.45" />
        <path d="M152 136C134 118 130 96 138 76C156 92 160 114 152 136Z" fill="var(--color-hills-mid)" opacity="0.8" />
        <circle cx="162" cy="106" r="5" fill="var(--color-peach)" opacity="0.9" />
      </svg>
    </div>
  )
}
