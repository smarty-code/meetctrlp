import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"

export const metadata = {
  title: "CtrlP Print",
  description: "Scan a shop QR to upload documents and print.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
