import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { faqTabs, minFaqItemsPerTab } from "@/content/faq"
import { plans } from "@/content/pricing.server"
import { journeySteps } from "@/content/steps"
import { getRenderableFaqTabs } from "@/lib/faq"
import { faqPageSchema } from "@/lib/schema"
import { Plans } from "@/components/sections/Plans"

describe("FAQ rendering rules", () => {
  it("drops questions with unprovided answers or unverified claims", () => {
    const rendered = getRenderableFaqTabs().flatMap((tab) => tab.items)
    expect(rendered.every((item) => item.answer.length > 0)).toBe(true)
    expect(
      rendered.some((item) => item.question === "How long does setup take?")
    ).toBe(false)
    expect(
      rendered.some((item) => item.question === "Do I need new hardware?")
    ).toBe(false)
  })

  it("hides a tab left with fewer than the minimum questions", () => {
    const tabs = getRenderableFaqTabs([
      { key: "shops", label: "Shops", items: [{ question: "Q", answer: "A" }] },
      ...faqTabs.filter((tab) => tab.key === "customers"),
    ])
    expect(tabs.map((tab) => tab.key)).not.toContain("shops")
    expect(tabs.every((tab) => tab.items.length >= minFaqItemsPerTab)).toBe(
      true
    )
  })

  it("builds FAQPage JSON-LD only from rendered items", () => {
    const schema = faqPageSchema()
    const rendered = getRenderableFaqTabs().flatMap((tab) => tab.items)
    expect(schema.mainEntity).toHaveLength(rendered.length)
    expect(JSON.stringify(schema)).not.toContain("{{")
  })
})

describe("journey", () => {
  it("has exactly five steps", () => {
    expect(journeySteps).toHaveLength(5)
  })
})

describe("pricing gate", () => {
  it("keeps plan names and prices out of the markup while the flag is off", () => {
    const html = renderToStaticMarkup(<Plans />)
    for (const plan of plans) {
      expect(html).not.toContain(plan.name)
      expect(html).not.toContain(`₹${plan.perDay}`)
      expect(html).not.toContain(`₹${plan.perMonth}`)
    }
    expect(html).not.toMatch(/per (day|month)/i)
  })
})
