import { cn } from "@/lib/cn"

type HillsVariant = "bottom" | "panel" | "sky" | "thumb"

type HillsProps = {
  variant: HillsVariant
  /** Dark tint for the closing block on forest (PRD 5.12). */
  tone?: "light" | "forest"
  /** Thumbnail crop and palette shift, one per "How to start" step (PRD 4.6). */
  seed?: number
  className?: string
}

const fills = {
  light: [
    "var(--color-lime-soft)",
    "var(--color-hills-mid)",
    "var(--color-lime)",
  ],
  forest: [
    "var(--color-hills-forest-1)",
    "var(--color-hills-forest-2)",
    "var(--color-hills-forest-1)",
  ],
  peach: [
    "var(--color-lime-soft)",
    "var(--color-peach)",
    "var(--color-hills-mid)",
  ],
} as const

/** Three overlapping hill outlines per viewBox; the back hill first. */
const shapes = {
  bottom: {
    viewBox: "0 0 1440 400",
    paths: [
      "M0 220C220 120 420 170 660 130C900 90 1180 170 1440 110V400H0Z",
      "M0 290C180 220 400 210 620 260C860 315 1120 220 1440 250V400H0Z",
      "M0 350C260 300 520 290 820 330C1080 365 1280 320 1440 330V400H0Z",
    ],
  },
  panel: {
    viewBox: "0 0 800 600",
    paths: [
      "M0 330C130 270 270 300 410 250C560 200 690 260 800 220V600H0Z",
      "M0 420C150 370 300 360 450 410C600 455 700 390 800 410V600H0Z",
      "M0 500C170 465 360 455 540 490C660 515 740 495 800 500V600H0Z",
    ],
  },
  sky: {
    viewBox: "0 0 1440 600",
    paths: [
      "M0 420C240 340 470 380 720 330C980 280 1200 360 1440 310V600H0Z",
      "M0 480C210 430 450 425 690 465C940 505 1190 440 1440 460V600H0Z",
      "M0 545C300 515 600 510 900 535C1130 552 1300 538 1440 545V600H0Z",
    ],
  },
  thumb: {
    viewBox: "0 0 400 300",
    paths: [
      "M0 150C70 110 140 135 210 105C280 75 340 115 400 95V300H0Z",
      "M0 205C80 170 160 165 240 195C310 220 360 190 400 200V300H0Z",
      "M0 255C90 235 190 230 280 248C340 260 380 252 400 255V300H0Z",
    ],
  },
} as const

const thumbTransforms = [
  "",
  "translate(400 0) scale(-1 1)",
  "translate(-60 -30) scale(1.3)",
] as const

/** Painterly hills (PRD 4.6): pure SVG with a grain overlay, decorative only. */
export function Hills({
  variant,
  tone = "light",
  seed = 0,
  className,
}: HillsProps) {
  const shape = shapes[variant]
  const palette =
    tone === "forest"
      ? fills.forest
      : variant === "thumb" && seed === 1
        ? fills.peach
        : fills.light
  const grainId = `grain-${variant}-${tone}-${seed}`
  const blurId = `cloud-${variant}-${tone}`
  const transform =
    variant === "thumb"
      ? thumbTransforms[seed % thumbTransforms.length]
      : undefined

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none",
        className
      )}
    >
      <svg
        viewBox={shape.viewBox}
        preserveAspectRatio={variant === "thumb" ? "xMidYMid slice" : "none"}
        className="block size-full"
      >
        <defs>
          <filter id={grainId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          {variant === "sky" && (
            <filter id={blurId}>
              <feGaussianBlur stdDeviation="18" />
            </filter>
          )}
        </defs>
        {variant === "sky" && (
          <g
            filter={`url(#${blurId})`}
            className={tone === "forest" ? "opacity-10" : "opacity-60"}
          >
            <ellipse
              cx="300"
              cy="150"
              rx="190"
              ry="44"
              fill="var(--color-surface)"
            />
            <ellipse
              cx="1080"
              cy="210"
              rx="240"
              ry="52"
              fill="var(--color-surface)"
            />
          </g>
        )}
        <g transform={transform}>
          <path d={shape.paths[0]} fill={palette[0]} className="opacity-90" />
          <path d={shape.paths[1]} fill={palette[1]} className="opacity-80" />
          <path
            d={shape.paths[2]}
            fill={palette[2]}
            className={tone === "forest" ? "opacity-60" : "opacity-40"}
          />
        </g>
        <rect
          width="100%"
          height="100%"
          filter={`url(#${grainId})`}
          className="opacity-6 mix-blend-multiply"
        />
      </svg>
    </div>
  )
}
