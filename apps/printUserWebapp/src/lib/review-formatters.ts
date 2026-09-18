import { ColorMode, PrintConfiguration } from "../types/upload"
import { REVIEW_COPY } from "../data/review-constants"

/**
 * Formats page selection into human readable text:
 * "All pages" or "Pages 1, 3, 5-8"
 */
export function formatPageSelectionSummary(
  pageSelection: PrintConfiguration["pageSelection"],
  totalPageCount: number
): string {
  if (pageSelection.mode === "all" || !pageSelection.expression?.trim()) {
    return REVIEW_COPY.allPages
  }

  // If selected pages span all pages anyway, show All pages
  if (
    pageSelection.pages.length === totalPageCount &&
    pageSelection.pages.length > 0
  ) {
    return REVIEW_COPY.allPages
  }

  return `${REVIEW_COPY.pagesPrefix} ${pageSelection.expression.trim()}`
}

/**
 * Returns human-readable label for color mode without exposing internal identifiers
 */
export function formatColorMode(colorMode: ColorMode): string {
  return colorMode === "color" ? REVIEW_COPY.colorLabel : REVIEW_COPY.bwLabel
}

/**
 * Formats copies count with correct singular/plural grammar
 */
export function formatCopies(copies: number): string {
  return copies === 1 ? REVIEW_COPY.copiesSingular : REVIEW_COPY.copiesPlural(copies)
}

/**
 * Formats page count with correct singular/plural grammar
 */
export function formatPageCount(count: number): string {
  return count === 1 ? REVIEW_COPY.pagesSingular : REVIEW_COPY.pagesPlural(count)
}

/**
 * Formats paper size with fallback to default A4
 */
export function formatPaperSize(paperSize?: string): string {
  return paperSize || REVIEW_COPY.defaultPaperSize
}
