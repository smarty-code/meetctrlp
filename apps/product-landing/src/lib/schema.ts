import { site } from "@/config/site"
import { seoCopy } from "@/content/meta"
import { getRenderableFaqTabs } from "@/lib/faq"

/** JSON-LD Organization with name and URL only (PRD 7.4). */
export function organizationSchema() {
  return {
    "@context": site.schemaContext,
    "@type": "Organization",
    name: seoCopy.organization,
    url: site.url,
  }
}

/** FAQPage built from verified, rendered FAQ items only (PRD 7.4). */
export function faqPageSchema() {
  const items = getRenderableFaqTabs().flatMap((tab) => tab.items)
  return {
    "@context": site.schemaContext,
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }
}
