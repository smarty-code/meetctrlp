import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google"
import { siteConfig } from "@/config/site-content"
import "./globals.css"

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-din-round",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
})

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-feather",
  display: "swap",
  weight: ["600", "700"],
})

export const viewport: Viewport = {
  themeColor: "#000437",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: siteConfig.seo.title,
  description: siteConfig.seo.description,
  keywords: siteConfig.seo.keywords,
  metadataBase: new URL(siteConfig.urls.base),
  alternates: {
    canonical: siteConfig.urls.base,
  },
  openGraph: {
    title: siteConfig.seo.title,
    description: siteConfig.seo.description,
    url: siteConfig.urls.base,
    siteName: siteConfig.brand.name,
    locale: "en_IN",
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
      lang="en"
      className={`${sansFont.variable} ${displayFont.variable} scroll-smooth antialiased`}
    >
      <body className="min-h-screen bg-paper text-charcoal font-sans selection:bg-eel-light selection:text-midnight">
        {children}
      </body>
    </html>
  )
}
