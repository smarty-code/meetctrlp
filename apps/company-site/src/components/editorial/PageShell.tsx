import type { ReactNode } from "react"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"

/** The homepage's ruled boxed grid (side rails on desktop) with the shared header and footer. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col font-sans selection:bg-lime-soft selection:text-ink">
      <div className="w-full max-w-6xl mx-auto border-x-0 lg:border-x border-neutral-200/80 flex flex-col min-h-screen bg-bg">
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}
