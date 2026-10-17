/** Behaviour constants that JavaScript needs (CSS values live in styles/tokens.css). */
export const ui = {
  /** Header turns solid after this much scroll, in px (PRD 3.3). */
  headerScrollThreshold: 24,
  /** Entrance animations start when this share of an element is visible (PRD 4.7). */
  revealThreshold: 0.2,
  /** Hero loop timeline in ms (PRD 5.1): press → travel → paid → printing → hold → reset. */
  heroLoop: {
    press: 600,
    travel: 600,
    toPrinting: 1000,
    hold: 2000,
    total: 6000,
  },
} as const
