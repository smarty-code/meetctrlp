import type { MetadataRoute } from "next"
import { siteConfig } from "@/content/site-config"

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/pricing", "/vision", "/print", "/print-shops", "/privacy", "/terms"]

  if (siteConfig.features.showJourney) {
    routes.push("/journey")
  }

  return routes.map((route) => ({
    url: `${siteConfig.urls.base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }))
}
