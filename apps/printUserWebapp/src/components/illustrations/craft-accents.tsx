import React from "react"

export const BlueScissorIcon: React.FC<{ className?: string }> = ({
  className = "w-16 h-16",
}) => (
  <svg
    className={className}
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Silver Blades pointing up-left */}
    <path
      d="M36 34 L8 12 L16 8 L38 30 Z"
      fill="#cbd5e1"
      stroke="#94a3b8"
      strokeWidth="1"
    />
    <path
      d="M34 36 L12 24 L8 28 L32 40 Z"
      fill="#94a3b8"
      stroke="#64748b"
      strokeWidth="1"
    />
    {/* Pivot Screw */}
    <circle cx="34" cy="34" r="3.5" fill="#475569" />
    <circle cx="34" cy="34" r="1.5" fill="#f8fafc" />
    {/* Blue Handles on bottom-right */}
    <path
      d="M36 30 L46 24"
      stroke="#0283fd"
      strokeWidth="4.5"
      strokeLinecap="round"
    />
    <circle
      cx="53"
      cy="22"
      r="9.5"
      stroke="#0283fd"
      strokeWidth="4.5"
      fill="none"
    />
    <path
      d="M32 38 L42 48"
      stroke="#0283fd"
      strokeWidth="4.5"
      strokeLinecap="round"
    />
    <circle
      cx="49"
      cy="52"
      r="9.5"
      stroke="#0283fd"
      strokeWidth="4.5"
      fill="none"
    />
  </svg>
)

export const TapeRollIcon: React.FC<{ className?: string }> = ({
  className = "w-12 h-12",
}) => (
  <svg
    className={className}
    viewBox="0 0 52 52"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Tape strip extending out */}
    <path d="M38 34 L48 40 L45 44 L35 38 Z" fill="#fbd2a4" />
    {/* Outer tape ring */}
    <circle
      cx="24"
      cy="24"
      r="19"
      fill="#fbd2a4"
      stroke="#f6ad7b"
      strokeWidth="2"
    />
    {/* Cardboard core */}
    <circle
      cx="24"
      cy="24"
      r="11"
      fill="#fef3c7"
      stroke="#fcd34d"
      strokeWidth="1.5"
    />
    {/* Inner hole */}
    <circle
      cx="24"
      cy="24"
      r="7.5"
      fill="#ffffff"
      stroke="#e2e8f0"
      strokeWidth="1"
    />
  </svg>
)

export const PolaroidPhoto: React.FC<{ className?: string }> = ({
  className = "w-16 h-20",
}) => (
  <svg
    className={className}
    viewBox="0 0 60 74"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Outer Polaroid Frame with subtle shadow */}
    <rect
      width="60"
      height="74"
      rx="3"
      fill="#ffffff"
      stroke="#e2e8f0"
      strokeWidth="1.5"
    />
    {/* Inner Photo Window */}
    <rect x="6" y="6" width="48" height="46" rx="2" fill="#fed7aa" />
    {/* Hills in photo */}
    <path
      d="M6 38 Q 20 28 36 34 Q 46 38 54 32 L 54 52 L 6 52 Z"
      fill="#fba97b"
    />
    {/* Blue circle sticker in center of photo */}
    <circle cx="30" cy="26" r="7.5" fill="#0283fd" />
  </svg>
)

export const SparkleRays: React.FC<{ className?: string }> = ({
  className = "w-6 h-6",
}) => (
  <svg
    className={className}
    viewBox="0 0 28 28"
    fill="none"
    stroke="#f59e0b"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="10" y1="4" x2="16" y2="10" />
    <line x1="22" y1="12" x2="16" y2="15" />
    <line x1="24" y1="22" x2="17" y2="18" />
  </svg>
)

export const CurledCorner: React.FC<{ className?: string }> = ({
  className = "w-8 h-8",
}) => (
  <div
    className={`pointer-events-none absolute right-0 bottom-0 overflow-hidden ${className}`}
  >
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      {/* Cutout showing page behind */}
      <path d="M0 32 L32 0 L32 32 Z" fill="#ffffff" />
      {/* Curled flap */}
      <path
        d="M0 32 L32 0 Q 18 16 0 32 Z"
        fill="#fef9c3"
        stroke="#eab308"
        strokeWidth="0.75"
        strokeOpacity="0.4"
      />
    </svg>
  </div>
)

export const PromiseUnderline: React.FC = () => (
  <svg
    width="90"
    height="8"
    viewBox="0 0 90 8"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 5 C 24 1, 62 7, 88 3"
      stroke="#0283fd"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
)
