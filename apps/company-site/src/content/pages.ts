/**
 * Copy for the editorial subpages: /pricing and /vision.
 * Layout follows the Vestris pricing and vision pages; the words are MeetCtrlP's.
 */

export const breadcrumbCopy = {
  root: { label: "Product", href: "/" },
  separator: "/",
  ariaLabel: "Breadcrumb",
} as const

export const pricingPage = {
  meta: {
    title: "Pricing | MeetCtrlP",
    description:
      "One plan, built for your shop. Custom CtrlP pricing based on your print volume, printers and counter workflow.",
  },
  breadcrumb: "Pricing",
  headline: { line1: "One plan,", line2: "built for your shop." },
  card: {
    title: "Let's talk.",
    body: "Custom pricing based on your daily print volume, printer setup, and counter workflow. Tell us about your shop and we'll put together a simple plan that fits.",
    cta: { label: "Contact us for pricing", href: "/#contact" },
    altLead: "Prefer WhatsApp or a quick call?",
    altWhatsapp: "Talk to us on WhatsApp",
    altJoiner: "or",
    altCall: "Request a call",
    whatsappMessage:
      "Hi MeetCtrlP, I run a print shop and I'd like to know about CtrlP pricing.",
  },
  includedTitle: "What's included",
  included: [
    "Unlimited QR code orders and multi-format uploads (PDF, DOCX, PPTX, JPG, PNG)",
    "Zero customer app installs or sign-ups — scan, configure, and send in seconds",
    "Automatic upfront price calculation for colour, B&W, copies, paper size, and page ranges",
    "Flexible counter payments — support instant online payment or “Pay at shop”",
    "CtrlP Desktop App with live print queue and direct local USB/network spooler integration",
    "Counter QR standee kit, printer configuration, and dedicated shop onboarding",
  ],
} as const

export const visionPage = {
  meta: {
    title: "Our Vision | MeetCtrlP",
    description:
      "Printing a document shouldn't take so much back-and-forth. Why we're building CtrlP for local print shops.",
  },
  breadcrumb: "Vision",
  heading: { open: "(", first: "Our", second: "Vision", close: ")" },
  subtitle: "A simpler everyday workflow",
  paragraphs: [
    "Printing a document shouldn't take so much back-and-forth. Every job at a busy counter starts the same way. Ask for the shop's number. Send the file on WhatsApp. Explain which pages need colour. Confirm the number of copies. Wait while the shop downloads the file, opens it, and works out the settings.",
    "Necessary details. All of them. But a simple print job shouldn't cost customers and shop owners so many manual, repetitive steps.",
    "CtrlP starts the moment someone scans a shop's QR code. Documents uploaded. Colour, copies, paper size, and page ranges configured upfront. Price shown clearly before payment. Orders delivered straight into the shop's desktop queue, structured and ready for the printer. Both sides open the screen and the confusion is already behind them.",
    "This was never about changing how local print shops serve their neighbourhoods. It's about giving shop owners the room to run a calmer, faster counter.",
    "Because no customer misses waiting in a crowded queue repeating instructions over the counter. They remember the shop where getting documents printed before an exam, an interview, or an urgent deadline simply worked.",
    "That's the everyday work local shops make happen.",
  ],
  closing: "That's what MeetCtrlP is built to simplify.",
  signoffRole: "Founder, MeetCtrlP",
} as const
