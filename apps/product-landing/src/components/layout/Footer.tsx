import { footerCopy } from "@/content/nav"
import { Container } from "@/components/layout/Container"
import { currentYear, fill } from "@/lib/format"
import { isExternal } from "@/lib/links"

/** Footer (PRD 5.13). */
export function Footer() {
  return (
    <footer className="border-t border-line bg-bg">
      <Container className="grid gap-12 py-16 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-2 lg:col-span-5">
          <p className="font-display text-display-m">
            {footerCopy.brand}{" "}
            <span className="text-body text-ink-soft">{footerCopy.byline}</span>
          </p>
          <p className="text-body text-ink-soft">{footerCopy.tagline}</p>
        </div>
        <nav
          aria-label={footerCopy.navLabel}
          className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-6 lg:col-start-7"
        >
          {footerCopy.columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h2 className="text-eyebrow text-ink-faint uppercase">
                {column.title}
              </h2>
              <ul className="flex flex-col gap-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(isExternal(link.href)
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="inline-flex min-h-tap items-center text-body text-ink-soft hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Container>
      <Container className="border-t border-line py-6">
        <p className="text-small text-ink-faint">
          {fill(footerCopy.bottomLine, { year: currentYear() })}
        </p>
      </Container>
    </footer>
  )
}
