import { sectionIds } from "@/config/routes"
import { AnalyticsObserver } from "@/components/layout/AnalyticsObserver"
import { Footer } from "@/components/layout/Footer"
import { Header } from "@/components/layout/Header"
import { JsonLd } from "@/components/layout/JsonLd"
import { RequestCallProvider } from "@/components/ui/RequestCall"
import { Contact } from "@/components/sections/Contact"
import { Customers } from "@/components/sections/Customers"
import { Faq } from "@/components/sections/Faq"
import { Hero } from "@/components/sections/Hero"
import { Journey } from "@/components/sections/Journey"
import { Money } from "@/components/sections/Money"
import { Plans } from "@/components/sections/Plans"
import { Printers } from "@/components/sections/Printers"
import { Problem } from "@/components/sections/Problem"
import { Shops } from "@/components/sections/Shops"
import { Start } from "@/components/sections/Start"
import { Trust } from "@/components/sections/Trust"
import { faqPageSchema } from "@/lib/schema"

/** The single page (PRD 3.1): sections in the order of Section 5. */
export default function HomePage() {
  return (
    <RequestCallProvider>
      <Header />
      <main id={sectionIds.main} tabIndex={-1} className="outline-none">
        <Hero />
        <Journey />
        <Customers />
        <Problem />
        <Shops />
        <Printers />
        <Money />
        <Plans />
        <Trust />
        <Start />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <AnalyticsObserver />
      <JsonLd data={faqPageSchema()} />
    </RequestCallProvider>
  )
}
