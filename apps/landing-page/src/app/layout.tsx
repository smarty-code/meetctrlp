import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CtrlP — Instant Print Orders at Local Print Shops",
  description:
    "Skip the print queue. Scan shop QR, upload your documents, configure print settings, and pick up your prints in seconds.",
  keywords: [
    "print shop",
    "cloud printing",
    "campus printing",
    "ctrlp",
    "instant print",
    "pdf printing",
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-paper text-charcoal font-sans selection:bg-eel-light selection:text-midnight">
        {children}
      </body>
    </html>
  )
}
