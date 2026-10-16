import type { Metadata, Viewport } from "next"
import { Instrument_Serif, Inter } from "next/font/google"
import { siteConfig } from "@/content/site-config"
import "./globals.css"

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const viewport: Viewport = {
  themeColor: siteConfig.seo.themeColor,
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: siteConfig.seo.title,
  description: siteConfig.seo.description,
  metadataBase: new URL(siteConfig.urls.base),
  alternates: {
    canonical: siteConfig.urls.base,
  },
  openGraph: {
    title: siteConfig.seo.title,
    description: siteConfig.seo.description,
    url: siteConfig.urls.base,
    siteName: siteConfig.brand.name,
    locale: siteConfig.seo.locale,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.seo.title,
    description: siteConfig.seo.description,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en-IN"
      className={`${instrumentSerif.variable} ${inter.variable} antialiased`}
    >
      <body className="min-h-screen bg-bg text-ink font-sans selection:bg-lime-soft selection:text-ink">
        {children}
      </body>
    </html>
  )
}
