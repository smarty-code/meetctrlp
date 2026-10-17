import { redirect } from "next/navigation"
import { site } from "@/config/site"

/**
 * /terms points at the main site's terms until this site has its own text (PRD 3.2).
 * TODO(owner): approve linking the main site's page, or supply this site's terms.
 */
export default function TermsPage() {
  redirect(site.mainSiteTermsUrl)
}
