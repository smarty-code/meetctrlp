import React from "react"

interface HillsProps {
  variant?: "bottom" | "panel" | "sky"
  className?: string
  isDark?: boolean
}

export function Hills({ variant = "bottom", className = "", isDark = false }: HillsProps) {
  // Pure SVG implementation under 10KB, responsive and never blocks LCP
  if (variant === "bottom") {
    return (
      <div
        className={`absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden h-[38%] select-none ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          className="w-full h-full block"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="grain-bottom">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="noise" />
              <feColorMatrix type="saturate" values="0" />
              <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
            </filter>
          </defs>

          {/* Back hill */}
          <path
            d="M-50,320 C180,180 420,240 680,160 C940,80 1200,210 1500,140 L1500,320 Z"
            fill="var(--color-lime-soft)"
            fillOpacity="0.45"
          />

          {/* Middle hill */}
          <path
            d="M-60,320 C120,220 380,140 640,220 C900,300 1180,170 1500,240 L1500,320 Z"
            fill="#CFE79A"
            fillOpacity="0.4"
          />

          {/* Front hill */}
          <path
            d="M-40,320 C200,260 480,210 820,270 C1120,320 1320,230 1490,260 L1490,320 Z"
            fill="var(--color-lime)"
            fillOpacity="0.25"
          />

          {/* Subtle noise grain layer */}
          <rect width="100%" height="100%" fill="#000" opacity="0.03" style={{ mixBlendMode: "multiply" }} />
        </svg>
      </div>
    )
  }

  if (variant === "panel") {
    return (
      <div
        className={`absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden h-[45%] select-none rounded-b-[inherit] ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 800 240"
          preserveAspectRatio="none"
          className="w-full h-full block"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Back hill */}
          <path
            d="M-20,240 C140,120 320,180 500,110 C680,40 760,140 840,90 L840,240 Z"
            fill="var(--color-lime-soft)"
            fillOpacity="0.5"
          />

          {/* Front hill */}
          <path
            d="M-20,240 C120,170 300,130 520,180 C700,220 780,150 840,180 L840,240 Z"
            fill="#CFE79A"
            fillOpacity="0.4"
          />
        </svg>
      </div>
    )
  }

  // Sky variant (for closing block / dark forest)
  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none rounded-[inherit] ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        className="w-full h-full block"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {isDark ? (
          <>
            {/* Dark sky gradient */}
            <rect width="100%" height="100%" fill="var(--color-forest)" />
            {/* Deep hills */}
            <path
              d="M-40,400 C200,270 480,310 750,240 C1020,170 1180,260 1250,210 L1250,400 Z"
              fill="#1E3322"
              fillOpacity="0.7"
            />
            <path
              d="M-40,400 C150,320 400,260 680,330 C940,390 1120,280 1250,320 L1250,400 Z"
              fill="#2A4A30"
              fillOpacity="0.5"
            />
          </>
        ) : (
          <>
            <path
              d="M-40,400 C200,270 480,310 750,240 C1020,170 1180,260 1250,210 L1250,400 Z"
              fill="var(--color-lime-soft)"
              fillOpacity="0.3"
            />
            <path
              d="M-40,400 C150,320 400,260 680,330 C940,390 1120,280 1250,320 L1250,400 Z"
              fill="#CFE79A"
              fillOpacity="0.25"
            />
          </>
        )}
      </svg>
    </div>
  )
}
