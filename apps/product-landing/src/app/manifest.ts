import type { MetadataRoute } from "next"
import { routes } from "@/config/routes"
import { site } from "@/config/site"
import { seoCopy } from "@/content/meta"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: seoCopy.siteName,
    short_name: seoCopy.shortName,
    description: seoCopy.description,
    start_url: routes.home,
    display: "browser",
    background_color: site.themeColor,
    theme_color: site.themeColor,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  }
}
