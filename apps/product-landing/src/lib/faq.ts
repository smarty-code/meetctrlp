import {
  faqTabs,
  minFaqItemsPerTab,
  type FaqItem,
  type FaqTabKey,
} from "@/content/faq"
import { isVerified } from "@/lib/claims"

export type RenderableFaqItem = FaqItem & { readonly answer: string }

export type RenderableFaqTab = {
  readonly key: FaqTabKey
  readonly label: string
  readonly items: readonly RenderableFaqItem[]
}

function isRenderable(item: FaqItem): item is RenderableFaqItem {
  if (item.answer === null) return false
  return item.claim === undefined || isVerified(item.claim)
}

/** Tabs with only answered, verified questions; tabs left with too few questions are dropped (PRD 5.11). */
export function getRenderableFaqTabs(
  tabs: ReadonlyArray<{
    key: FaqTabKey
    label: string
    items: readonly FaqItem[]
  }> = faqTabs
): RenderableFaqTab[] {
  return tabs
    .map((tab) => ({
      key: tab.key,
      label: tab.label,
      items: tab.items.filter(isRenderable),
    }))
    .filter((tab) => tab.items.length >= minFaqItemsPerTab)
}
