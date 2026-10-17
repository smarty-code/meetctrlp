import { sectionIds } from "@/config/routes"
import { ctas } from "@/content/copy"
import { faqCopy } from "@/content/faq"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { ButtonLink } from "@/components/ui/Button"
import { WhatsAppButton } from "@/components/ui/TrackedLinks"
import { Eyebrow, DisplayHeading } from "@/components/ui/Typography"
import { FaqTabs } from "@/components/sections/FaqTabs"
import { getRenderableFaqTabs } from "@/lib/faq"
import { mailtoLink } from "@/lib/links"

/** 5.11 FAQ. Only answered, verified questions reach the client (and the FAQPage JSON-LD). */
export function Faq() {
  const tabs = getRenderableFaqTabs()
  if (tabs.length === 0) return null

  return (
    <Section id={sectionIds.faq}>
      <Container className="flex max-w-faq flex-col gap-10">
        <div className="flex flex-col items-center gap-6 text-center">
          <Eyebrow>{faqCopy.eyebrow}</Eyebrow>
          <DisplayHeading
            id={headingId(sectionIds.faq)}
            headline={faqCopy.headline}
          />
        </div>
        <FaqTabs tabs={tabs} />
        <div className="flex flex-col items-center gap-4 border-t border-line pt-10 text-center sm:flex-row sm:justify-between sm:text-start">
          <p className="text-h3 font-semibold">{faqCopy.stillTitle}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <WhatsAppButton location="faq" block>
              {ctas.talkToHuman}
            </WhatsAppButton>
            <ButtonLink href={mailtoLink()} variant="secondary" block>
              {ctas.contact}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  )
}
