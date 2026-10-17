/** SEO and page-level copy (PRD 7.4, 9.8). */
export const seoCopy = {
  title:
    "CtrlP for print shops | QR orders, payments and printing in one place",
  description:
    "CtrlP gives print shops QR-based orders, clear payments and a simple way to print. See how it works and talk to us.",
  siteName: "CtrlP for print shops",
  shortName: "CtrlP Shops",
  organization: "MeetCtrlP",
  ogHeadline: "Your print shop, run from one screen.",
  ogAlt: "CtrlP for print shops: Your print shop, run from one screen.",
} as const

/** Request-a-call modal (PRD 5.12). */
export const formCopy = {
  title: "Request a call",
  intro: "Leave your number and we'll call you back.",
  close: "Close",
  fields: {
    name: { label: "Name", autoComplete: "name" },
    phone: {
      label: "Phone",
      hint: "10-digit mobile number, +91 optional",
      autoComplete: "tel",
    },
    shopName: { label: "Shop name (optional)", autoComplete: "organization" },
    city: { label: "City (optional)", autoComplete: "address-level2" },
  },
  honeypotLabel: "Leave this field empty",
  submit: "Request a call",
  submitting: "Sending…",
  success: "Thanks. We'll get back to you soon.",
  error: "Something went wrong. Please try WhatsApp instead.",
  notice: "We'll only use your details to respond to this request.",
  privacyLink: "See our Privacy Policy.",
  done: "Done",
  errors: {
    nameRequired: "Please enter your name.",
    nameTooLong: "Please keep your name under 80 characters.",
    phoneInvalid: "Enter a 10-digit mobile number, with or without +91.",
    optionalTooLong: "Please keep this under 100 characters.",
    tooMany: "Too many requests. Please try WhatsApp instead.",
  },
} as const

/** Fallback routes (PRD 9.8). */
export const systemCopy = {
  notFoundTitle: "This page isn't here.",
  notFoundText:
    "The link may be old or mistyped. Start again from the home page.",
  errorTitle: "Something went wrong.",
  errorText: "Please try again. If it keeps happening, message us on WhatsApp.",
  retry: "Try again",
  home: "Back to home",
} as const
