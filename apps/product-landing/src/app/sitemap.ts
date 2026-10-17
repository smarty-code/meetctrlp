import type { MetadataRoute } from "next"
import { routes } from "@/config/routes"
import { site } from "@/config/site"

/**
 * Only pages served by this site. /privacy and /terms redirect to the main site for now,
 * so they join the sitemap once they have their own text (PRD 7.4).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${site.url}${routes.home}`,
      changeFrequency: "monthly",
      priority: 1,
    },
  ]
}
