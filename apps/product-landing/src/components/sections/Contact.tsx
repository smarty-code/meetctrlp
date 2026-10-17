import { sectionIds } from "@/config/routes"
import { contactCopy } from "@/content/copy"
import { Hills } from "@/components/concepts/Hills"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { RequestCallButton } from "@/components/ui/RequestCall"
import { CustomerAppLink, WhatsAppButton } from "@/components/ui/TrackedLinks"
import { BracketLabel, DisplayHeading } from "@/components/ui/Typography"

/** 5.12 Closing CTA: a forest block on a dark cloud painting. */
export function Contact() {
  return (
    <Section
      id={sectionIds.contact}
      tone="forest"
      className="overflow-hidden rounded-t-xl"
    >
      <Hills variant="sky" tone="forest" />
      <Container className="relative grid gap-12 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <BracketLabel className="text-ink-on-forest">
            {contactCopy.bracket}
          </BracketLabel>
          <DisplayHeading
            id={headingId(sectionIds.contact)}
            headline={contactCopy.headline}
            tone="forest"
          />
          <p className="max-w-prose text-body-l text-ink-on-forest">
            {contactCopy.body}
          </p>
        </div>
        <div className="flex flex-col justify-end gap-3 lg:col-span-5 lg:col-start-8">
          <WhatsAppButton location="contact" className="w-full" />
          <RequestCallButton
            location="contact"
            variant="secondaryOnForest"
            className="w-full"
          />
          <p className="mt-3 border-t border-line-on-forest pt-6 text-small text-ink-on-forest">
            {contactCopy.customerLead}{" "}
            <CustomerAppLink
              location="contact"
              className="min-h-0 px-0 text-small text-lime underline underline-offset-2 hover:text-ink-on-forest"
            >
              {contactCopy.customerLink}
            </CustomerAppLink>
          </p>
        </div>
      </Container>
    </Section>
  )
}
