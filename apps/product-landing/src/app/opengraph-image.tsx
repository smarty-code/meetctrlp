import { ImageResponse } from "next/og"
import { site } from "@/config/site"
import { seoCopy } from "@/content/meta"

export const alt = seoCopy.ogAlt
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/*
 * The OG renderer cannot read CSS variables, so these mirror tokens.css:
 * --color-bg, --color-ink, --color-lime-soft, --color-hills-mid, --color-lime.
 */
const og = {
  bg: "#F8F9F8", // audit-ignore-line
  ink: "#111611", // audit-ignore-line
  hills: ["#E7F4BE", "#CFE79A", "#B8E04A"], // audit-ignore-line
} as const

/** Instrument Serif for the headline; falls back to the default face if the font can't be fetched. */
async function displayFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(site.ogFontCssUrl)).text()
    const url = css.match(
      /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/
    )?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch {
    return null
  }
}

/** Off-white, lime hills and the hero line in the display font; no product claims (PRD 7.4). */
export default async function OpengraphImage() {
  const font = await displayFont()
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: og.bg,
        position: "relative",
      }}
    >
      <svg
        width="1200"
        height="630"
        viewBox="0 0 1200 630"
        style={{ position: "absolute", inset: 0 }}
      >
        <path
          d="M0 420C200 340 380 380 600 340C820 300 1000 370 1200 320V630H0Z"
          fill={og.hills[0]}
        />
        <path
          d="M0 500C170 450 360 445 560 485C760 525 980 455 1200 480V630H0Z"
          fill={og.hills[1]}
        />
        <path
          d="M0 570C250 540 500 535 750 555C940 570 1080 560 1200 565V630H0Z"
          fill={og.hills[2]}
          opacity="0.4"
        />
      </svg>
      <div
        style={{
          display: "flex",
          padding: "96px",
          fontSize: 96,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: og.ink,
          maxWidth: 1000,
          fontFamily: font ? "Instrument Serif" : "serif",
        }}
      >
        {seoCopy.ogHeadline}
      </div>
    </div>,
    {
      ...size,
      ...(font
        ? {
            fonts: [
              {
                name: "Instrument Serif",
                data: font,
                style: "normal" as const,
              },
            ],
          }
        : {}),
    }
  )
}
