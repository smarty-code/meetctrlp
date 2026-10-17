import { redirect } from "next/navigation"
import { site } from "@/config/site"

/**
 * /privacy points at the main site's policy until this site has its own text (PRD 3.2).
 * TODO(owner): approve linking the main site's page, or supply this site's policy.
 */
export default function PrivacyPage() {
  redirect(site.mainSitePrivacyUrl)
}
