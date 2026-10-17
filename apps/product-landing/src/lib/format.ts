import { site } from "@/config/site"

const rupees = new Intl.NumberFormat(site.locale, {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const numbers = new Intl.NumberFormat(site.locale)

/** Rupee amount with Indian digit grouping (lakh style: 1,20,000). */
export function formatRupees(amount: number): string {
  return rupees.format(amount)
}

export function formatNumber(value: number): string {
  return numbers.format(value)
}

/** Two-digit step number, for example 1 → "01". */
export function formatStep(index: number): string {
  return String(index).padStart(2, "0")
}

export function currentYear(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(site.locale, { year: "numeric" }).format(date)
}

/** Replace `{name}` slots in a content template. Templates come from src/content. */
export function fill(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}
