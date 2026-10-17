"use client"

import { useEffect, useState } from "react"
import { events } from "@/config/analytics"
import { faqTabIds } from "@/config/routes"
import { faqCopy, type FaqTabKey } from "@/content/faq"
import { Accordion } from "@/components/ui/Accordion"
import { Tabs } from "@/components/ui/Tabs"
import type { RenderableFaqTab } from "@/lib/faq"
import { track } from "@/lib/track"

const hashToTab: Record<string, FaqTabKey> = {
  [`#${faqTabIds.shops}`]: "shops",
  [`#${faqTabIds.customers}`]: "customers",
}

/** FAQ tab switch (Print shops default) over a single-open accordion. Tabs deep-link via the URL hash. */
export function FaqTabs({ tabs }: { tabs: readonly RenderableFaqTab[] }) {
  const [current, setCurrent] = useState<FaqTabKey>(tabs[0]?.key ?? "shops")

  useEffect(() => {
    const sync = () => {
      const fromHash = hashToTab[window.location.hash]
      if (!fromHash || !tabs.some((tab) => tab.key === fromHash)) return
      setCurrent(fromHash)
      window.requestAnimationFrame(() =>
        document.getElementById(faqTabIds[fromHash])?.scrollIntoView()
      )
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [tabs])

  const select = (key: FaqTabKey) => {
    setCurrent(key)
    track(events.faqTab, { tab: key })
    window.history.replaceState(null, "", `#${faqTabIds[key]}`)
  }

  const renderList = (tab: RenderableFaqTab) => (
    <Accordion
      key={tab.key}
      items={tab.items.map((item) => ({
        ...item,
        id: `${faqTabIds[tab.key]}-${tab.items.indexOf(item)}`,
      }))}
      onOpen={(index) => track(events.faqOpen, { tab: tab.key, index })}
    />
  )

  if (tabs.length === 1 && tabs[0]) {
    return <div id={faqTabIds[tabs[0].key]}>{renderList(tabs[0])}</div>
  }

  return (
    <Tabs
      label={faqCopy.tabsLabel}
      tabs={tabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        id: faqTabIds[tab.key],
      }))}
      current={current}
      onSelect={select}
    >
      {(key) => {
        const tab = tabs.find((candidate) => candidate.key === key)
        return tab ? renderList(tab) : null
      }}
    </Tabs>
  )
}
