import { site } from "@/config/site"

/** WhatsApp chat link with a prefilled, URL-encoded message (PRD 3.4, 5.12). */
export function whatsappLink(
  message: string,
  number: string = site.whatsappNumber
): string {
  const digits = number.replace(/\D/g, "")
  return `${site.whatsappBaseUrl}${digits}?text=${encodeURIComponent(message)}`
}

/** mailto link for the contact email. */
export function mailtoLink(email: string = site.contactEmail): string {
  return `mailto:${email}`
}

/** True for links that leave this site, so they can open safely in a new tab. */
export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href)
}
