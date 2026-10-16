import React from "react"

interface FounderIllustrationProps {
  className?: string
}

export function FounderIllustration({ className = "" }: FounderIllustrationProps) {
  return (
    <figure
      className={`relative w-full max-w-[360px] aspect-[4/5] rounded-3xl bg-lime-soft/60 border border-line overflow-hidden shadow-card flex items-center justify-center p-4 ${className}`}
      aria-label="Illustration of a person working at a desk with a laptop and a small printer."
    >
      <figcaption className="sr-only">
        Illustration of a person working at a desk with a laptop and a small printer.
      </figcaption>

      <svg
        viewBox="0 0 400 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block select-none"
      >
        <defs>
          <filter id="illustration-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" result="noise" />
            <feColorMatrix type="saturate" values="0" />
            <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
          </filter>
        </defs>

        {/* Room Background / Window */}
        <rect x="30" y="30" width="160" height="190" rx="16" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="2" />
        
        {/* Soft hills outside window */}
        <path d="M30,170 C70,120 120,150 190,110 L190,220 L30,220 Z" fill="#CFE79A" />
        <path d="M30,190 C90,160 140,180 190,150 L190,220 L30,220 Z" fill="var(--color-lime)" fillOpacity="0.4" />
        <line x1="110" y1="30" x2="110" y2="220" stroke="var(--color-ink)" strokeWidth="1.5" />
        <line x1="30" y1="125" x2="190" y2="125" stroke="var(--color-ink)" strokeWidth="1.5" />

        {/* Sticky Notes on Wall */}
        <rect x="220" y="50" width="36" height="36" rx="4" fill="var(--color-lime)" stroke="var(--color-ink)" strokeWidth="1.5" transform="rotate(4 220 50)" />
        <rect x="270" y="45" width="34" height="34" rx="4" fill="var(--color-peach)" stroke="var(--color-ink)" strokeWidth="1.5" transform="rotate(-6 270 45)" />

        {/* Desk Surface */}
        <path d="M20,340 L380,340 L380,365 L20,365 Z" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
        {/* Desk Legs */}
        <line x1="60" y1="365" x2="60" y2="480" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
        <line x1="340" y1="365" x2="340" y2="480" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />

        {/* Potted Plant */}
        <path d="M35,340 L50,340 L46,315 L39,315 Z" fill="var(--color-peach)" stroke="var(--color-ink)" strokeWidth="2" />
        <path d="M42,315 C30,290 20,280 15,285 C25,295 38,305 42,315" fill="var(--color-lime-deep)" stroke="var(--color-ink)" strokeWidth="1.5" />
        <path d="M43,315 C55,285 65,275 70,280 C60,292 48,304 43,315" fill="var(--color-lime)" stroke="var(--color-ink)" strokeWidth="1.5" />

        {/* Desktop Printer on Desk Right */}
        <rect x="250" y="270" width="105" height="70" rx="10" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="2" />
        {/* Paper feeder */}
        <rect x="270" y="245" width="65" height="25" rx="3" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="1.5" />
        {/* Output slot */}
        <rect x="265" y="300" width="75" height="12" rx="3" fill="var(--color-forest)" />
        {/* Printed paper page */}
        <path d="M272,306 L332,306 L328,328 L276,328 Z" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.5" />
        {/* Status LED */}
        <circle cx="340" cy="285" r="3" fill="var(--color-lime)" />

        {/* Person (Faceless / minimal hand-drawn look) */}
        {/* Chair back */}
        <rect x="130" y="250" width="75" height="120" rx="12" fill="var(--color-forest)" stroke="var(--color-ink)" strokeWidth="2" />

        {/* Body / Torso */}
        <path d="M110,340 C110,265 140,250 170,250 C200,250 225,265 225,340 Z" fill="var(--color-forest)" stroke="var(--color-ink)" strokeWidth="2" />

        {/* Head and Hair */}
        <circle cx="165" cy="205" r="28" fill="var(--color-peach)" stroke="var(--color-ink)" strokeWidth="2" />
        {/* Hair */}
        <path d="M142,205 C142,180 155,175 175,175 C195,175 198,190 192,205 C185,188 175,186 160,192 Z" fill="var(--color-ink)" />

        {/* Laptop on Desk */}
        {/* Laptop Screen */}
        <polygon points="175,270 235,270 230,325 170,325" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="2" />
        <rect x="178" y="277" width="48" height="40" fill="var(--color-lime-soft)" />
        {/* Screen lines representing code / dashboard */}
        <line x1="183" y1="285" x2="210" y2="285" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
        <line x1="183" y1="293" x2="200" y2="293" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
        {/* Laptop Base */}
        <path d="M155,325 L245,325 L248,333 L152,333 Z" fill="var(--color-ink)" />

        {/* Arm typing on laptop */}
        <path d="M135,290 C150,305 160,320 180,323" stroke="var(--color-ink)" strokeWidth="8" strokeLinecap="round" />
        <circle cx="183" cy="323" r="5" fill="var(--color-peach)" />

        {/* Paper texture overlay */}
        <rect width="100%" height="100%" fill="#000" opacity="0.02" style={{ mixBlendMode: "multiply" }} />
      </svg>
    </figure>
  )
}
