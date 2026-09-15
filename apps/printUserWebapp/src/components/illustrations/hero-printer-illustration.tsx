import React from "react"

interface HeroPrinterIllustrationProps {
  isAvailable?: boolean
}

export const HeroPrinterIllustration: React.FC<
  HeroPrinterIllustrationProps
> = ({ isAvailable = true }) => {
  return (
    <div className="pointer-events-none relative mx-auto flex h-[160px] w-full max-w-[340px] items-center justify-center select-none">
      <svg
        className="h-full w-full overflow-visible"
        viewBox="0 0 340 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Floating Paper scrap left */}
        <g transform="translate(14, 80) rotate(-14)">
          <rect
            width="28"
            height="36"
            rx="4"
            fill="#ffffff"
            stroke="#3c3c3c"
            strokeWidth="1.5"
          />
          <line
            x1="4"
            y1="8"
            x2="24"
            y2="8"
            stroke="#1cb0f6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="4"
            y1="14"
            x2="18"
            y2="14"
            stroke="#777777"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="4"
            y1="19"
            x2="22"
            y2="19"
            stroke="#777777"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        {/* Small craft scissors left */}
        <g transform="translate(28, 92) rotate(-22)">
          {/* blades */}
          <path
            d="M22 14L40 4M22 18L40 28"
            stroke="#777777"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="24" cy="16" r="1.5" fill="#3c3c3c" />
          {/* blue handles */}
          <ellipse
            cx="14"
            cy="11"
            rx="7"
            ry="5"
            stroke="#1cb0f6"
            strokeWidth="3"
            fill="none"
          />
          <ellipse
            cx="14"
            cy="22"
            rx="7"
            ry="5"
            stroke="#1cb0f6"
            strokeWidth="3"
            fill="none"
          />
        </g>

        {/* Lime paper patch left */}
        <rect
          x="58"
          y="104"
          width="22"
          height="18"
          rx="4"
          fill="#a5ed6e"
          stroke="#3c3c3c"
          strokeWidth="1.5"
          transform="rotate(8 58 104)"
        />

        {/* Floating Paper scrap right */}
        <g transform="translate(285, 76) rotate(16)">
          <rect
            width="36"
            height="48"
            rx="4"
            fill="#ffffff"
            stroke="#3c3c3c"
            strokeWidth="1.5"
          />
          <line
            x1="6"
            y1="10"
            x2="24"
            y2="10"
            stroke="#58cc02"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="17"
            x2="30"
            y2="17"
            stroke="#777777"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="23"
            x2="28"
            y2="23"
            stroke="#777777"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        {/* Printer Flat Ground Offset (No drop shadow) */}
        <ellipse
          cx="170"
          cy="132"
          rx="100"
          ry="8"
          fill="#042c60"
          opacity="0.15"
        />

        {!isAvailable ? (
          /* Cover cloth over printer */
          <g>
            <path
              d="M75 42 Q170 30 265 42 L280 115 Q260 128 240 120 Q200 130 170 122 Q130 132 100 121 Q80 127 60 115 Z"
              fill="#777777"
              stroke="#3c3c3c"
              strokeWidth="2"
            />
            <path
              d="M100 50 C110 80 105 110 95 120"
              stroke="#3c3c3c"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M170 42 C165 75 175 105 170 122"
              stroke="#3c3c3c"
              strokeWidth="2"
              fill="none"
            />
          </g>
        ) : (
          /* Flat, tactile modern printer */
          <g>
            {/* Top Paper Input Feed */}
            <g transform="translate(110, 20)">
              <rect
                x="8"
                y="2"
                width="104"
                height="40"
                rx="4"
                fill="#ffffff"
                stroke="#3c3c3c"
                strokeWidth="2"
              />
              <line
                x1="20"
                y1="12"
                x2="70"
                y2="12"
                stroke="#777777"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="20"
                y1="18"
                x2="90"
                y2="18"
                stroke="#777777"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="20"
                y1="24"
                x2="80"
                y2="24"
                stroke="#777777"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>

            {/* Rear support */}
            <path
              d="M96 38 L244 38 L252 56 L88 56 Z"
              fill="#4b4b4b"
              stroke="#3c3c3c"
              strokeWidth="2"
            />

            {/* Main Printer Body */}
            <path
              d="M72 54 C72 48 76 44 82 44 L258 44 C264 44 268 48 268 54 L276 112 C276 118 271 123 265 123 L75 123 C69 123 64 118 64 112 Z"
              fill="#ffffff"
              stroke="#3c3c3c"
              strokeWidth="2.5"
            />

            {/* Ecto Green / Macaw Blue Accent Strip */}
            <path d="M66 70 L274 70" stroke="#58cc02" strokeWidth="4" />

            {/* Front Paper Output Cavity */}
            <rect
              x="96"
              y="78"
              width="148"
              height="34"
              rx="4"
              fill="#000437"
              stroke="#3c3c3c"
              strokeWidth="2"
            />

            {/* Printed Paper Extending Out */}
            <g transform="translate(112, 84)">
              <rect
                x="0"
                y="0"
                width="116"
                height="46"
                rx="4"
                fill="#ffffff"
                stroke="#3c3c3c"
                strokeWidth="2"
              />
              <rect
                x="10"
                y="8"
                width="28"
                height="22"
                rx="2"
                fill="#d7ffb8"
                stroke="#58cc02"
                strokeWidth="1"
              />
              <line
                x1="44"
                y1="12"
                x2="104"
                y2="12"
                stroke="#58cc02"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="44"
                y1="18"
                x2="96"
                y2="18"
                stroke="#3c3c3c"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="44"
                y1="24"
                x2="102"
                y2="24"
                stroke="#777777"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="36"
                x2="104"
                y2="36"
                stroke="#777777"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>

            {/* Status LED: Ecto Green */}
            <circle
              cx="84"
              cy="94"
              r="4"
              fill="#58cc02"
              stroke="#4cae02"
              strokeWidth="1.5"
            />

            {/* Button */}
            <rect
              x="78"
              y="104"
              width="14"
              height="6"
              rx="2"
              fill="#a5ed6e"
              stroke="#3c3c3c"
              strokeWidth="1"
            />
          </g>
        )}
      </svg>
    </div>
  )
}
