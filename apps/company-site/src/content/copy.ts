import { claims } from "./claims"

/**
 * MeetCtrlP Page Copy
 * Source of truth: PRD Section 5
 * All copy is strictly typed and non-hardcoded in visual components.
 */

export const siteCopy = {
  header: {
    wordmark: "MeetCtrlP",
    navItems: [
      { label: "Product", href: "/#how-it-works" },
      { label: "For Print Shops", href: "/print-shops" },
      { label: "Pricing", href: "/pricing" },
      { label: "Vision", href: "/vision" },
    ],
    journeyItem: { label: "Journey", href: "/journey" },
    primaryCta: { label: "Explore CtrlP", href: "/#how-it-works" },
    mobileMenu: {
      openLabel: "Open navigation menu",
      closeLabel: "Close navigation menu",
    },
    skipToContent: "Skip to content",
  },

  hero: {
    bracket: "( Meet CtrlP )",
    headlineStart: "Printing, ",
    headlineEmphasis: "rethought.",
    subhead:
      "CtrlP connects people who need prints with the shops that make them happen. A simpler way to send documents, manage print jobs and bring the entire process together.",
    primaryCta: { label: "Explore CtrlP", href: "#how-it-works" },
    secondaryCta: { label: "For Print Shops", href: "/print-shops" },
    microcopy: "Built for the everyday work of getting documents printed.",
  },

  factStrip: {
    // Items are dynamically verified via claims registry
    fallbackMessage: "Simple, structured printing for people and shops.",
  },

  problem: {
    eyebrow: "THE WAY WE PRINT TODAY",
    h2Start: "A simple print job shouldn't take ",
    h2Emphasis: "so much work.",
    body: "A customer sends a document on WhatsApp. The shop downloads it, checks the instructions, works out the settings and starts printing. It works, but too much depends on manual steps and repeated explanations.",
    closingStart: "The problem isn't printing. It's everything ",
    closingEmphasis: "around it.",
    messyState: {
      bubbles: [
        "Please print this, colour",
        "How many copies?",
        "2, and only pages 1 to 5",
        "sorry, send again",
      ],
      files: ["resume_final_v2.pdf", "marksheet (1).pdf"],
    },
    cleanState: {
      orderId: "#CP10482",
      badge: "Paid",
      doc1: "Resume.pdf · 3 pages · Colour · 1 copy",
      doc2: "Marksheet.pdf · 4 pages · B&W · 2 copies",
      total: "₹42",
    },
    caption: "Illustrative. Not a live screenshot.",
  },

  howItWorks: {
    eyebrow: "HOW IT WORKS",
    h2Start: "One order. A ",
    h2Emphasis: "clearer",
    h2End: " way forward.",
    intro:
      "From the first upload to the final print, CtrlP is designed to make each step easier to understand.",
    steps: [
      {
        number: "01",
        title: "Upload and configure",
        line: "Your documents, your settings.",
        detail:
          "Scan the shop's QR code and upload your files. For each one, choose colour or black and white, copies, paper size and pages. See the price before you pay.",
      },
      {
        number: "02",
        title: "The shop takes it from here",
        line: "Orders arrive structured.",
        detail: claims.autoPrint.verified
          ? "The shop reviews the order in its desktop software, accepts it, and sends the job to a connected printer."
          : "The shop reviews the order in its desktop software and accepts it.",
      },
      {
        number: "03",
        title: "Collect",
        line: "Ready when you are.",
        detail:
          "Follow your order's progress and pick up your prints when the shop marks them ready.",
      },
    ],
    links: [
      { label: "See how printing works →", href: "/print" },
      { label: "See the shop experience →", href: "/print-shops" },
    ],
  },

  doors: {
    eyebrow: "TWO WAYS IN",
    h2Start: "Two ways in. ",
    h2Emphasis: "One",
    h2End: " connected workflow.",
    doorA: {
      label: "FOR PEOPLE PRINTING",
      titleStart: "Got something to ",
      titleEmphasis: "print?",
      body: claims.noAccount.verified
        ? "Scan the QR code at a participating print shop, upload your documents and send your order. No account needed."
        : "Scan the QR code at a participating print shop, upload your documents and send your order.",
      buttonLabel: "See how printing works →",
      href: "/print",
      note: "CtrlP orders start from a shop's QR code, so look for it at the counter.",
    },
    doorB: {
      label: "FOR PRINT SHOPS",
      titleStart: "Run a print ",
      titleEmphasis: "shop?",
      body: "Receive structured orders, manage print jobs in one place and connect supported printers through the desktop app.",
      buttonLabel: "Discover CtrlP for Print Shops",
      href: "/print-shops",
      textLink: { label: "Talk to us →", href: "#contact" },
    },
  },

  trust: {
    eyebrow: "DESIGNED WITH CARE",
    h2Start: "You stay in control. Your documents are ",
    h2Emphasis: "protected.",
  },

  founder: {
    eyebrow: "WHY WE'RE BUILDING THIS",
    h2Start: "We believe everyday software can be ",
    h2Emphasis: "better.",
    body: "Print shops are part of how people study, work and get things done. Yet the process around a simple print job can still involve a lot of unnecessary manual work. We're starting with printing, learning from the people who use it and building around the realities of their work.",
    closing: "One real problem at a time.",
    signatureRole: "Founder, MeetCtrlP",
    journeyLinkText: "Follow our journey →",
  },

  contact: {
    bracket: "( Get in touch )",
    h2Start: "Have a question, an idea or a shop to bring on ",
    h2Emphasis: "board?",
    body: "We would love to hear from you. Whether you run a print shop, want to learn more about CtrlP or have an idea worth discussing, get in touch.",
    block1: {
      label: "For print shop owners",
      text: "Interested in using CtrlP at your shop? Talk to us about your setup, supported printers and onboarding.",
      whatsappBtn: "Talk to us on WhatsApp",
      requestCallBtn: "Request a call",
    },
    block2: {
      label: "For general enquiries",
      text: "Have a question about MeetCtrlP or want to discuss a collaboration?",
      contactLink: "Contact us →",
    },
    form: {
      title: "Request a call",
      nameLabel: "Your Name",
      namePlaceholder: "Enter your full name",
      phoneLabel: "Phone Number",
      phonePlaceholder: "+91 98765 43210",
      shopNameLabel: "Shop Name (optional)",
      shopNamePlaceholder: "Your print shop name",
      submitBtn: "Request a call",
      submittingBtn: "Submitting...",
      successMsg: "Thanks. We'll get back to you soon.",
      errorMsg: "Something went wrong. Please try WhatsApp instead.",
      privacyNotice: "We'll only use your details to respond to this request. See our",
      privacyLinkText: "Privacy Policy.",
    },
  },

  footer: {
    brand: "MeetCtrlP",
    tagline: "Thoughtful software for everyday work.",
    colProduct: {
      title: "Product",
      links: [
        { label: "CtrlP", href: "/#how-it-works" },
        { label: "Print User", href: "/print" },
        { label: "For Print Shops", href: "/print-shops" },
        { label: "Pricing", href: "/pricing" },
      ],
      userNote: "Printing starts at a participating shop's QR code.",
    },
    colCompany: {
      title: "Company",
      links: [
        { label: "Vision", href: "/vision" },
        { label: "Contact", href: "/#contact" },
      ],
      journeyLink: { label: "Our Journey", href: "/journey" },
    },
    colLegal: {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
    bottomLine: "© 2026 MeetCtrlP. Made with care.",
  },

  conceptData: {
    sampleDataCaption: "Sample data",
    order1: {
      id: "#CP10482",
      statusPaid: "Paid",
      statusPrinting: "Printing…",
      doc1: {
        name: "Resume.pdf",
        meta: "3 pages · Colour · 1 copy · A4 · All pages",
        price: "₹30",
        size: "120 KB",
      },
      doc2: {
        name: "Marksheet.pdf",
        meta: "4 pages · Black & white · 2 copies · A4 · Pages 1, 2, 4",
        price: "₹12",
      },
      total: "₹42",
      printer: "Xerox Printer 01 · Connected",
    },
    order2: {
      id: "#CP10483",
      price: "₹74",
      statusPayAtShop: "Pay at shop",
    },
  },
} as const
