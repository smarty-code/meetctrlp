/**
 * MeetCtrlP Central Site Configuration & Content
 * Source of truth for brand, navigation, copy, features, changelog, and contact details.
 * Refined per Visual Refinement PRD (editorial pacing, calm hierarchy, 7 core sections).
 */

export interface NavItem {
  label: string
  href: string
}

export interface WorkflowStep {
  number: string
  title: string
  summary: string
  customerAction: string
  shopAction: string
  sampleData: string
}

export interface ChangelogPreviewItem {
  version: string
  date: string
  title: string
  summary: string
}

export interface FaqItem {
  question: string
  answer: string
}

export const siteConfig = {
  brand: {
    name: "MeetCtrlP",
    productName: "CtrlP",
    tagline: "Thoughtful software for everyday work.",
  },
  assets: {
    heroWorkflow: {
      src: "/images/meetctrlp-hero-workflow.png",
      alt: "MeetCtrlP connected workflow illustration showing customer phone, document upload, and print queue",
      width: 1536,
      height: 1024,
    },
    userQrUpload: {
      src: "/images/meetctrlp-user-qr-upload.png",
      alt: "Print User QR code entry standee and document upload flow illustration",
      width: 1536,
      height: 1024,
    },
    printerWorkspaceWide: {
      src: "/images/meetctrlp-printer-workspace-wide.png",
      alt: "Print shop counter workspace with desktop order queue and connected laser printers",
      width: 1672,
      height: 941,
    },
    printerWorkspace: {
      src: "/images/meetctrlp-printer-workspace.png",
      alt: "Print shop desktop print queue and hardware printer integration",
      width: 1672,
      height: 941,
    },
    documentPrivacy: {
      src: "/images/meetctrlp-document-privacy.png",
      alt: "Careful document handling and transient retention illustration",
      width: 1774,
      height: 887,
    },
  },
  urls: {
    base: "https://meetctrlp.in",
    app: "https://app.meetctrlp.in",
    forPrintShops: "/for-print-shops",
    changelog: "/changelog",
    about: "/about",
    privacy: "/privacy",
    terms: "/terms",
    whatsapp: "https://wa.me/919876543210?text=Hello%20MeetCtrlP%20team%2C%20I%20run%20a%20print%20shop%20and%20would%20like%20to%20learn%20more.",
    callRequestUrl: "/for-print-shops#onboard-form",
    email: "contact@meetctrlp.in",
    phone: "+91 98765 43210",
  },
  seo: {
    title: "MeetCtrlP | Printing, without the back-and-forth.",
    description:
      "Send your documents and print preferences digitally. Your local print shop receives a clear job, ready to process through supported printer integration.",
    keywords: [
      "MeetCtrlP",
      "CtrlP",
      "print shop software",
      "document printing",
      "local printer integration",
      "cloud print workflow",
      "campus print queue",
    ],
  },
  navigation: {
    main: [
      { label: "Product", href: "/#workflow" },
      { label: "How It Works", href: "/#problem" },
      { label: "For Print Shops", href: "/for-print-shops" },
      { label: "About", href: "/about" },
    ] as NavItem[],
    primaryCta: {
      label: "Start a print job",
      href: "/#workflow",
    },
    shopCta: {
      label: "For print shops",
      href: "/for-print-shops",
    },
  },
  hero: {
    eyebrow: "A simpler way to print",
    headline: "Printing, without the back-and-forth.",
    supportingCopy:
      "Send your documents and print preferences digitally. Your local print shop receives a clear job, ready to process.",
    primaryCta: {
      label: "Start a print job",
      href: "/#workflow",
    },
    secondaryCta: {
      label: "For print shops",
      href: "/for-print-shops",
    },
  },
  problemAndPromise: {
    headline: "From scattered messages to a clear print job.",
    copy: "No more searching through chats for files and instructions. Customers submit their documents and print choices together, while the shop receives the job in one organized place.",
    comparison: {
      today: {
        title: "Today's friction",
        points: [
          "Files scattered across WhatsApp chats, unread messages, and loose USB pendrives",
          "Customer phone numbers exposed across counter conversations",
          "Operators repeatedly re-asking color, duplex, and page range requirements",
        ],
      },
      withCtrlP: {
        title: "With MeetCtrlP",
        points: [
          "One structured order combining files, duplex, color, and copy counts",
          "Zero app downloads needed—runs directly in the customer's mobile browser",
          "Shop desktop queue receives complete job specs ready to spool in one click",
        ],
      },
    },
    workflowStrip: [
      {
        step: "01",
        title: "Scan shop QR",
        description: "Customer scans the physical counter standee.",
      },
      {
        step: "02",
        title: "Upload & set options",
        description: "Choose copies, sides, color mode, and page ranges.",
      },
      {
        step: "03",
        title: "Shop receives job",
        description: "Job rings directly into the desktop queue ready to print.",
      },
    ],
  },
  workflow: {
    headline: "Every print job arrives with the details that matter.",
    supportingCopy:
      "Customers upload files, choose print settings, review the order, and select a payment method. The shop receives the job with its files and selected options together.",
    steps: [
      {
        number: "01",
        title: "Scan and upload",
        summary: "Open the shop's Print User page and upload supported documents.",
        customerAction: "Customer scans counter QR standee and attaches PDF documents without creating an account.",
        shopAction: "Shop context is locked: local queue pricing and supported paper formats load instantly.",
        sampleData: "Corner Print Works • Table #1 • 2 PDF documents attached",
      },
      {
        number: "02",
        title: "Choose print settings",
        summary: "Set available options such as colour, copies, sides, paper size, and page selection.",
        customerAction: "Customer selects Black & White, Double-sided (Duplex), 1 copy, standard A4 paper.",
        shopAction: "Settings are constrained strictly to what this shop's connected printers can produce.",
        sampleData: "B&W • Duplex • 1 copy • 14 total pages",
      },
      {
        number: "03",
        title: "Review and pay",
        summary: "Check the order summary and choose an available payment method.",
        customerAction: "Order summary displays the exact breakdown computed from the shop's live rates. Customer chooses UPI or counter cash.",
        shopAction: "Job ticket #CP-2084 generated with transparent rate calculation.",
        sampleData: "Subtotal: ₹21.00 • Order #CP-2084 confirmed",
      },
      {
        number: "04",
        title: "Shop receives the job",
        summary: "The partner reviews the request and processes it through the desktop workflow.",
        customerAction: "Customer sees live status: 'Queued at shop counter'.",
        shopAction: "Shop desktop app sounds an audio chime and dispatches to HP LaserJet Pro in one click.",
        sampleData: "Queue position: 1 • Spooling via Windows GDI • Ready in 2 mins",
      },
    ] as WorkflowStep[],
  },
  differentiator: {
    eyebrow: "CORE DIFFERENTIATOR",
    headline: "From digital request to the shop's printer.",
    copy: "MeetCtrlP connects the customer-facing print request with the shop's desktop workflow, bringing the job closer to the printer instead of leaving staff to piece together files and instructions from chats.",
    points: [
      {
        title: "Incoming job queue",
        description:
          "Real-time Server-Sent Events (SSE) deliver incoming orders instantly to the shop desk with audible cues and zero manual refreshing.",
      },
      {
        title: "Review job details",
        description:
          "Operator inspects multi-document bundles, explicit duplex flags, and page selections on one clean desktop screen.",
      },
      {
        title: "Print through supported integration",
        description:
          "Native .NET 8 agent communicates directly with Windows GDI spoolers, routing to the least-busy compatible printer automatically.",
      },
    ],
    cta: {
      label: "Explore the print-shop workflow",
      href: "/for-print-shops",
    },
  },
  privacy: {
    eyebrow: "DATA HANDLING & TRUST",
    headline: "Your documents deserve careful handling.",
    copy: "Print jobs can contain personal information. MeetCtrlP treats document privacy as a core product requirement and designs the workflow to keep files connected to the job they belong to.",
    principles: [
      {
        title: "Purposeful access",
        description:
          "Documents are accessible only to the originating customer session and the specific shop partner fulfilling the order.",
      },
      {
        title: "Clear job handling",
        description:
          "Files are transferred over encrypted TLS channels and stored transiently using signed expiring URLs.",
      },
      {
        title: "Privacy-conscious design",
        description:
          "Files are held only as long as needed to fulfill the job, after which automated deletion purges both cloud and local cache copies.",
      },
    ],
    disclosure:
      "Publication verification standard: Statements match verified engineering controls in apps/server and apps/print-agent. We do not claim permanent zero-retention or client-side homomorphic encryption where transient buffers are required for spooling.",
    linkText: "Read our full document privacy policy",
    linkHref: "/privacy",
  },
  partner: {
    headline: "A clearer workflow for the people behind every print job.",
    copy: "MeetCtrlP is built for local print shops that want a more organized way to receive customer files, review print requirements, and move jobs through their existing shop workflow.",
    benefits: [
      {
        title: "Receive organized requests",
        description: "Replace messy WhatsApp threads with structured job tickets that arrive with exact settings.",
      },
      {
        title: "Review files & settings together",
        description: "Customers configure page ranges and paper format on their phones; you review and approve before printing.",
      },
      {
        title: "Connect directly to your printers",
        description: "Our lightweight desktop app integrates with your existing Windows print drivers without driver rewrites.",
      },
    ],
    guidedNote:
      "Shop setup is guided: Our team works directly with you to verify PC specs, inspect supported printers, and set up your counter standee. Subscription pricing is not finalized—onboarding is currently guided.",
    cta: {
      label: "Explore MeetCtrlP for print shops",
      href: "/for-print-shops",
    },
    whatsappCta: {
      label: "Chat with our team on WhatsApp",
      href: "https://wa.me/919876543210?text=Hello%20MeetCtrlP%20team%2C%20I%20run%20a%20print%20shop%20and%20would%20like%20to%20learn%20more.",
    },
    callCta: {
      label: "Request an onboarding call",
      href: "/for-print-shops#onboard-form",
    },
  },
  changelogPreview: {
    headline: "Built in the open.",
    lead: "A concise record of recent verified milestones shipped to our partner shops.",
    items: [
      {
        version: "v0.4.0",
        date: "October 14, 2026",
        title: "Multi-Document Print Jobs & 7-Day Shop Hours",
        summary:
          "Support for multi-file customer bundles and synchronized 7-day operating hours across server, desktop, and web.",
      },
      {
        version: "v0.3.0",
        date: "October 02, 2026",
        title: "Windows Local Printer Discovery & Test Spooling",
        summary:
          "Automatic local print queue discovery via EnumPrinters and 1-page test print diagnostics from desktop drawer.",
      },
    ] as ChangelogPreviewItem[],
    viewAllCta: {
      label: "View all product updates",
      href: "/changelog",
    },
  },
  faq: {
    headline: "Frequently asked questions.",
    lead: "Common questions from customers and print shop owners.",
    items: [
      {
        question: "Do customers need to create an account or install an app?",
        answer:
          "No. Customers simply scan the shop's physical counter QR code with their phone camera. The web application opens directly in their mobile browser, allowing instant file upload and configuration.",
      },
      {
        question: "Which file formats are supported?",
        answer:
          "CtrlP supports standard PDF files and common document formats. Files are validated for page count and format compatibility before submission.",
      },
      {
        question: "How does a print shop get started?",
        answer:
          "Onboarding is guided. Our team assists you in checking your Windows computer, verifying compatible printer drivers, and providing your customized counter QR standee.",
      },
      {
        question: "How does printer integration work?",
        answer:
          "Our lightweight desktop agent runs on your Windows PC and communicates directly with your existing Windows print spooler (GDI APIs). You don't have to replace your printers or install unverified third-party drivers.",
      },
      {
        question: "How can I contact the MeetCtrlP team?",
        answer:
          "You can message us directly on WhatsApp or submit an onboarding consultation request on our shop partner page.",
      },
    ] as FaqItem[],
  },
  finalCta: {
    headline: "Make the next print job simpler.",
    supportingCopy: "Start with a digital print request, or see how MeetCtrlP fits into your shop.",
    primaryCta: {
      label: "Start a print job",
      href: "/#workflow",
    },
    secondaryCta: {
      label: "I'm a print-shop owner",
      href: "/for-print-shops",
    },
  },
  footer: {
    brandStatement: "Thoughtful software for everyday work.",
    links: [
      { label: "Product Overview", href: "/#workflow" },
      { label: "How It Works", href: "/#problem" },
      { label: "For Print Shops", href: "/for-print-shops" },
      { label: "About MeetCtrlP", href: "/about" },
      { label: "Product Journey", href: "/changelog" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
    closing: "Made with care by MeetCtrlP.",
    copyright: `© ${new Date().getFullYear()} MeetCtrlP. All rights reserved.`,
  },

  // Full changelog for /changelog route
  changelog: {
    eyebrow: "BUILT IN THE OPEN",
    headline: "A product is never just one release.",
    lead: "Good software comes from paying attention, learning from real use, and improving the details over time. Our journey records what we build, what we learn, and what gets better.",
    entries: [
      {
        version: "v0.4.0",
        date: "October 14, 2026",
        title: "Multi-Document Print Jobs & 7-Day Shop Hours",
        status: "shipped",
        whatChanged: [
          "Supported multi-document order bundles with individual per-file page settings.",
          "Configurable 7-day shop operating hours with 12-hour dropdowns and overnight schedules.",
          "Synchronized operating hour rules across server, desktop, and mobile web clients.",
        ],
        whyItMatters:
          "Students often print multiple related documents in one go. Synchronized hours ensure customers never submit orders when a shop is closed.",
      },
      {
        version: "v0.3.0",
        date: "October 02, 2026",
        title: "Windows Local Printer Discovery & Test Spooling",
        status: "shipped",
        whatChanged: [
          "Integrated Windows GDI and EnumPrinters driver discovery in the .NET 8 agent sidecar.",
          "Hardware option catalog generation: auto-detects B&W vs Color and paper size capabilities.",
          "Real one-page test print diagnostic utility directly from the shop settings drawer.",
        ],
        whyItMatters:
          "Eliminates manual driver configuration. The shop connects their printer via USB or Wi-Fi, and CtrlP automatically surfaces valid capabilities.",
      },
      {
        version: "v0.2.0",
        date: "September 18, 2026",
        title: "Real-Time Server-Sent Events (SSE) Desktop Queue",
        status: "shipped",
        whatChanged: [
          "Authenticated SSE stream delivering instant order arrival snapshots and deltas.",
          "Automatic bounded reconnection with authoritative REST state reconciliation.",
          "Order filters for New, Active, Ready, and Completed with audio cue alerts.",
        ],
        whyItMatters:
          "Operators don't have to keep pressing 'Refresh'. Incoming customer orders appear on the desktop screen the moment payment is verified.",
      },
      {
        version: "v0.1.0",
        date: "August 28, 2026",
        title: "Shop-Specific QR Web Flow & Architecture Foundation",
        status: "shipped",
        whatChanged: [
          "Built zero-install mobile web app for customers scanning physical counter QR codes.",
          "Shared design tokens (@ctrlp/ui) and unified API schemas (@ctrlp/schemas).",
          "Initial transient document upload pipeline with signed storage tokens.",
        ],
        whyItMatters:
          "Proved the core thesis: customers can configure and submit prints in under 30 seconds without creating an account or downloading an app.",
      },
    ],
  },
  about: {
    eyebrow: "WHY WE'RE BUILDING THIS",
    headline: "We believe everyday software can be better.",
    lead: "Some of the most meaningful software doesn't solve a distant, abstract problem. It makes something people already do every day work a little better. Print shops are part of how people study, work, run businesses, and get things done. Yet the process around a simple print job can still involve unnecessary manual friction. MeetCtrlP exists to explore how thoughtful software can improve that experience.",
    closingQuote: "One real problem at a time. One thoughtful improvement at a time.",
  },
  privacyTrust: {
    eyebrow: "DESIGNED WITH CARE",
    headline: "Your documents are part of your life. We treat them accordingly.",
    lead: "A print order can contain personal, academic, professional, or financial information. CtrlP is being built with secure document handling, controlled access, and a clearly defined retention lifecycle in mind.",
  },
}
