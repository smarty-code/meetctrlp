import React from "react"

interface ConceptTagProps {
  variant?: "light" | "forest"
  className?: string
}

export function ConceptTag({ variant = "light", className = "" }: ConceptTagProps) {
  const isForest = variant === "forest"

  return (
    <div
      className={`absolute top-4 right-4 z-20 flex items-center gap-2 h-7 px-3 rounded-full text-xs font-medium select-none pointer-events-none transition-colors ${
        isForest
          ? "bg-forest/80 border border-line-on-forest text-ink-on-forest"
          : "bg-surface border border-line text-ink-soft shadow-xs"
      } ${className}`}
      aria-hidden="true"
    >
      <span className="w-2 h-2 rounded-full bg-lime shrink-0" />
      <span className="tracking-wide">Concept</span>
      <span className="sr-only">Concept preview, not a live screenshot.</span>
    </div>
  )
}
