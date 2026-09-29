const SHOP_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHOP_PATH = /(?:^|\/)s\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$|\?|#)/i

export function shopSlugFromQrPayload(raw: string): string | null {
  const text = raw.trim()
  if (!text) {
    return null
  }

  try {
    const url = new URL(text)
    const match = url.pathname.match(/^\/s\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i)
    if (match?.[1] && isShopSlug(match[1])) {
      return match[1].toLowerCase()
    }
  } catch {
    // Payload is not an absolute URL.
  }

  const pathMatch = text.match(SHOP_PATH)
  if (pathMatch?.[1] && isShopSlug(pathMatch[1])) {
    return pathMatch[1].toLowerCase()
  }

  if (isShopSlug(text) && text.length >= 4 && text.length <= 90) {
    return text.toLowerCase()
  }

  return null
}

function isShopSlug(value: string) {
  return SHOP_SLUG.test(value.toLowerCase())
}
