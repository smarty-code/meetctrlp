import { describe, expect, it } from "vitest"

import { updateShopHoursRequestSchema } from "@ctrlp/schemas"

import { defaultHours, editableHours, setOpen24x7, timeOptions } from "./dashboard"

function week(overrides: Record<string, unknown> = {}) {
  return defaultHours().map((hour) => ({ ...hour, isClosed: false, ...overrides }))
}

describe("shop hours editor", () => {
  it("offers 12-hour labels while keeping canonical values", () => {
    const options = timeOptions()
    expect(options).toHaveLength(96)
    expect(options[0]).toEqual({ value: "00:00", label: "12:00 AM" })
    expect(options.find((option) => option.value === "21:30")?.label).toBe("9:30 PM")
  })

  it("keeps an off-grid saved time selectable", () => {
    const options = timeOptions("09:10")
    expect(options).toHaveLength(97)
    expect(options.map((option) => option.value)).toContain("09:10")
  })

  it("fills missing days and older payloads without the 24-hour flag", () => {
    const hours = editableHours([
      { dayOfWeek: 1, opensAt: "10:00", closesAt: "19:00", isClosed: false } as never,
    ])
    expect(hours).toHaveLength(7)
    expect(hours[1]).toMatchObject({ opensAt: "10:00", closesAt: "19:00", isClosed: false, isOpen24Hours: false })
    expect(hours[0].isClosed).toBe(true)
  })

  it("turns every day on for 24/7 and back to regular hours", () => {
    const allDay = setOpen24x7(defaultHours(), true)
    expect(allDay.every((hour) => !hour.isClosed && hour.isOpen24Hours)).toBe(true)
    const regular = setOpen24x7(allDay, false)
    expect(regular.every((hour) => !hour.isClosed && !hour.isOpen24Hours)).toBe(true)
    expect(regular[0]).toMatchObject({ opensAt: "09:00", closesAt: "21:00" })
  })
})

describe("updateShopHoursRequestSchema", () => {
  it("accepts 12-hour input and stores canonical 24-hour times", () => {
    const parsed = updateShopHoursRequestSchema.parse({
      businessHours: week({ opensAt: "9:30 AM", closesAt: "9:00 pm" }),
    })
    expect(parsed.businessHours[0]).toMatchObject({ opensAt: "09:30", closesAt: "21:00", isOpen24Hours: false })
  })

  it("accepts hours that run past midnight", () => {
    expect(
      updateShopHoursRequestSchema.safeParse({ businessHours: week({ opensAt: "18:00", closesAt: "02:00" }) }).success,
    ).toBe(true)
  })

  it("accepts open-24-hours days and defaults the flag for older clients", () => {
    const legacy = defaultHours().map(({ isOpen24Hours: _ignored, ...hour }) => hour)
    expect(updateShopHoursRequestSchema.parse({ businessHours: legacy }).businessHours[0].isOpen24Hours).toBe(false)
    const allDay = updateShopHoursRequestSchema.parse({
      businessHours: week({ isOpen24Hours: true, opensAt: "00:00", closesAt: "00:00" }),
    })
    expect(allDay.businessHours.every((hour) => hour.isOpen24Hours)).toBe(true)
  })

  it("clears the 24-hour flag on closed days", () => {
    const parsed = updateShopHoursRequestSchema.parse({
      businessHours: defaultHours().map((hour) => ({ ...hour, isOpen24Hours: true })),
    })
    expect(parsed.businessHours.every((hour) => hour.isClosed && !hour.isOpen24Hours)).toBe(true)
  })

  it("rejects zero-length days and unreadable times", () => {
    const sameTime = updateShopHoursRequestSchema.safeParse({ businessHours: week({ closesAt: "09:00" }) })
    expect(sameTime.success).toBe(false)
    expect(sameTime.error?.issues[0]?.message).toMatch(/Open 24 hours/)
    expect(updateShopHoursRequestSchema.safeParse({ businessHours: week({ opensAt: "25:00" }) }).success).toBe(false)
  })
})
