/**
 * Number and currency formatting utilities (en-IN locale)
 * Governed by PRD Section 4.10, 9.3, 9.9
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat("en-IN")

export function formatRupees(amount: number): string {
  return inrFormatter.format(amount)
}

export function formatNumber(num: number): string {
  return numberFormatter.format(num)
}

export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[\s\-()]/g, "")
}

export function isValidIndianPhone(phone: string): boolean {
  const cleaned = cleanPhoneNumber(phone)
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned)
}
