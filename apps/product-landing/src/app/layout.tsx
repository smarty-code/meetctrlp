import type { Metadata, Viewport } from "next"
import { Instrument_Serif, Inter } from "next/font/google"
import Script from "next/script"
import type { ReactNode } from "react"
import { flags } from "@/config/flags"
import { routes } from "@/config/routes"
import { site } from "@/config/site"
import { seoCopy } from "@/content/meta"
import { JsonLd } from "@/components/layout/JsonLd"
import { organizationSchema } from "@/lib/schema"
import "@/styles/globals.css"

const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
  preload: true,
})

const body = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
})

export const viewport: Viewport = {
  themeColor: site.themeColor,
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: seoCopy.title,
  description: seoCopy.description,
  applicationName: seoCopy.siteName,
  alternates: { canonical: routes.home },
  openGraph: {
    type: "website",
    url: routes.home,
    siteName: seoCopy.siteName,
    title: seoCopy.title,
    description: seoCopy.description,
    locale: site.ogLocale,
  },
  twitter: {
    card: "summary_large_image",
    title: seoCopy.title,
    description: seoCopy.description,
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={site.locale} className={`${display.variable} ${body.variable}`}>
      <body className="bg-bg font-body text-ink antialiased selection:bg-lime-soft">
        {children}
        <JsonLd data={organizationSchema()} />
        {flags.analytics && site.analytics.domain && (
          <Script
            defer
            data-domain={site.analytics.domain}
            src={site.analytics.scriptUrl}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
