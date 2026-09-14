export interface CurrencyFormatOptions {
  currency?: string
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

const DEFAULT_CURRENCY = "INR"
const DEFAULT_LOCALE = "en-IN"

/**
 * Format any currency value using localized standard Intl.NumberFormat
 * Avoids manual concatenation of currency symbols in JSX.
 */
export function formatCurrency(
  amount: number,
  options: CurrencyFormatOptions = {}
): string {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount)
  } catch {
    // Graceful fallback if Intl fails
    const symbol = currency === "INR" ? "₹" : currency
    return `${symbol}${amount.toFixed(minimumFractionDigits)}`
  }
}
