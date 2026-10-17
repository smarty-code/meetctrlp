import type { MetadataRoute } from "next"
import { siteConfig } from "@/content/site-config"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.brand.name,
    short_name: siteConfig.brand.product,
    description: siteConfig.seo.description,
    start_url: "/",
    display: "standalone",
    background_color: "#F8F9F8",
    theme_color: "#F8F9F8",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  }
}
