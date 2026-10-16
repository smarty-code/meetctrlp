/** The CtrlP walkthrough shown on the home page and every shop page. */
export const PROMO_VIDEO_URL =
  "https://res.cloudinary.com/dtczitxk5/video/upload/v1792126600/I_Built_a_Tool_That_Auto-Creates_Shorts_from_Any_Video_1080p60_tet4qp.mp4"

const CLOUDINARY_UPLOAD = "res.cloudinary.com/"
const UPLOAD_SEGMENT = "/upload/"

function withCloudinaryTransform(url: string, transform: string): string {
  const at = url.indexOf(UPLOAD_SEGMENT)
  if (!url.includes(CLOUDINARY_UPLOAD) || at === -1) return url
  const head = url.slice(0, at + UPLOAD_SEGMENT.length)
  return `${head}${transform}/${url.slice(head.length)}`
}

/**
 * A 720p, auto-quality rendition: about half the bytes of the 1080p60 upload and
 * plenty for a phone-width card. Non-Cloudinary URLs pass through unchanged.
 */
export function getVideoSrc(url: string): string {
  return withCloudinaryTransform(url, "q_auto,w_1280,c_limit")
}

/** The first frame as an auto-format image, used as the player's poster. */
export function getVideoPoster(url: string): string | undefined {
  if (!url.includes(CLOUDINARY_UPLOAD)) return undefined
  const jpg = url.replace(/\.[a-z0-9]+(\?.*)?$/i, ".jpg")
  return withCloudinaryTransform(jpg, "so_0,w_960,c_limit,q_auto,f_auto")
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

/** The big centred play button, shared by the pre-load placeholder and the player so nothing shifts on swap. */
export const BIG_PLAY_BUTTON_CLASS =
  "flex size-12 items-center justify-center rounded-xl bg-midnight/50 text-paper transition-colors hover:bg-midnight/70"
