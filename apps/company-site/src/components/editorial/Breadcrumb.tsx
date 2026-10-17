import Link from "next/link"
import { breadcrumbCopy } from "@/content/pages"

/** "Product / Pricing" eyebrow centred above an editorial hero. */
export function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label={breadcrumbCopy.ariaLabel} className="rise-in">
      <ol className="inline-flex items-center gap-3 text-xs md:text-sm text-ink-faint">
        <li>
          <Link href={breadcrumbCopy.root.href} className="hover:text-ink transition-colors">
            {breadcrumbCopy.root.label}
          </Link>
        </li>
        <li aria-hidden="true" className="text-line">
          {breadcrumbCopy.separator}
        </li>
        <li aria-current="page" className="text-ink-soft">
          {current}
        </li>
      </ol>
    </nav>
  )
}
