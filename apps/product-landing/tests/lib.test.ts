import { describe, expect, it } from "vitest"
import { claims } from "@/content/claims"
import { resolveClaim, resolveGated, resolveGatedList } from "@/lib/claims"
import { currentYear, fill, formatRupees, formatStep } from "@/lib/format"
import { mailtoLink, whatsappLink } from "@/lib/links"
import { allowRequest, rateLimit, resetRateLimit } from "@/lib/rateLimit"
import { callRequestSchema, normalisePhone } from "@/lib/validation"

describe("claims registry", () => {
  it("renders verified text and the fallback for unverified claims", () => {
    expect(resolveClaim("zeroCommission")).toBe(claims.zeroCommission.text)
    expect(resolveClaim("autoPrint")).toBe(claims.autoPrint.fallback)
    expect(resolveClaim("noAccount")).toBeNull()
  })

  it("gates section copy on its claim", () => {
    expect(resolveGated({ text: "plain" })).toBe("plain")
    expect(resolveGated({ text: "claimed", claim: "zeroCommission" })).toBe(
      "claimed"
    )
    expect(
      resolveGated({
        text: "claimed",
        claim: "noAccount",
        fallback: "fallback",
      })
    ).toBe("fallback")
    expect(resolveGated({ text: "claimed", claim: "noAccount" })).toBeNull()
  })

  it("drops unverified items without a fallback from lists", () => {
    const list = resolveGatedList([
      { text: "a" },
      { text: "b", claim: "noAccount" },
      { text: "c", claim: "upi", fallback: "c2" },
    ])
    expect(list.map((item) => item.resolved)).toEqual(["a", "c2"])
  })
})

describe("link builders", () => {
  it("builds a WhatsApp link with the URL-encoded message", () => {
    expect(whatsappLink("Hi there, I'd like info", "+91 90000 00000")).toBe(
      "https://wa.me/919000000000?text=Hi%20there%2C%20I'd%20like%20info"
    )
  })

  it("builds a mailto link", () => {
    expect(mailtoLink("hello@shops.test")).toBe("mailto:hello@shops.test")
  })
})

describe("en-IN formatting", () => {
  it("formats rupees with Indian grouping", () => {
    expect(formatRupees(42)).toBe("₹42")
    expect(formatRupees(120000)).toBe("₹1,20,000")
  })

  it("formats step numbers, years and templates", () => {
    expect(formatStep(3)).toBe("03")
    expect(currentYear(new Date(2026, 0, 1))).toBe("2026")
    expect(fill("{a} and {b}", { a: 1, b: "two" })).toBe("1 and two")
    expect(fill("{missing}", {})).toBe("{missing}")
  })
})

describe("request-a-call validation", () => {
  const base = { name: "Asha", shopName: "", city: "", website: "" }

  it.each(["9876543210", "+91 98765 43210", "919876543210", "98765-43210"])(
    "accepts %s",
    (phone) => {
      const result = callRequestSchema.safeParse({ ...base, phone })
      expect(result.success && result.data.phone).toBe("9876543210")
    }
  )

  it.each(["12345", "98765432101", "abcdefghij", ""])("rejects %s", (phone) => {
    expect(callRequestSchema.safeParse({ ...base, phone }).success).toBe(false)
  })

  it("requires a name", () => {
    expect(
      callRequestSchema.safeParse({ ...base, name: "  ", phone: "9876543210" })
        .success
    ).toBe(false)
  })

  it("normalises phone prefixes", () => {
    expect(normalisePhone("+919876543210")).toBe("9876543210")
  })
})

describe("rate limit", () => {
  it("allows five requests per hour per key", () => {
    resetRateLimit()
    const now = 0
    for (let index = 0; index < rateLimit.max; index += 1)
      expect(allowRequest("ip", now)).toBe(true)
    expect(allowRequest("ip", now)).toBe(false)
    expect(allowRequest("other", now)).toBe(true)
    expect(allowRequest("ip", now + rateLimit.windowMs)).toBe(true)
  })
})
