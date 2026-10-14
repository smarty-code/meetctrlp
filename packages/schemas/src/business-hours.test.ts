import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type BusinessHourRule,
  businessHourProblem,
  describeBusinessHour,
  describeOpenStatus,
  formatTime12h,
  isOpenAt,
  parseTimeInput,
  shopClock,
  summarizeBusinessHours,
} from "./business-hours.ts";

function week(rule: Partial<BusinessHourRule>, overrides: Record<number, Partial<BusinessHourRule>> = {}) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: "09:00",
    closesAt: "21:00",
    isClosed: false,
    isOpen24Hours: false,
    ...rule,
    ...overrides[dayOfWeek],
  }));
}

const at = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

describe("business hours", () => {
  it("parses 12-hour and 24-hour input into canonical HH:mm", () => {
    assert.equal(parseTimeInput("9:30 PM"), "21:30");
    assert.equal(parseTimeInput("9 pm"), "21:00");
    assert.equal(parseTimeInput("09:05 a.m."), "09:05");
    assert.equal(parseTimeInput("12:00 AM"), "00:00");
    assert.equal(parseTimeInput("12:15 PM"), "12:15");
    assert.equal(parseTimeInput("7:45"), "07:45");
    assert.equal(parseTimeInput("23:59"), "23:59");
    assert.equal(parseTimeInput("13:00 PM"), null);
    assert.equal(parseTimeInput("24:00"), null);
    assert.equal(parseTimeInput("noon"), null);
  });

  it("formats canonical times in 12-hour form", () => {
    assert.equal(formatTime12h("00:00"), "12:00 AM");
    assert.equal(formatTime12h("09:05"), "9:05 AM");
    assert.equal(formatTime12h("12:00"), "12:00 PM");
    assert.equal(formatTime12h("21:30"), "9:30 PM");
  });

  it("describes each kind of day", () => {
    const [day] = week({});
    assert.equal(describeBusinessHour(day), "9:00 AM – 9:00 PM");
    assert.equal(describeBusinessHour({ ...day, opensAt: "18:00", closesAt: "02:00" }), "6:00 PM – 2:00 AM (next day)");
    assert.equal(describeBusinessHour({ ...day, closesAt: "00:00" }), "9:00 AM – 12:00 AM");
    assert.equal(describeBusinessHour({ ...day, isOpen24Hours: true }), "Open 24 hours");
    assert.equal(describeBusinessHour({ ...day, isClosed: true }), "Closed");
  });

  it("only rejects a zero-length day", () => {
    const [day] = week({});
    assert.equal(businessHourProblem({ ...day, opensAt: "18:00", closesAt: "02:00" }), null);
    assert.match(businessHourProblem({ ...day, closesAt: "09:00" }) ?? "", /can't be the same/);
    assert.equal(businessHourProblem({ ...day, closesAt: "09:00", isOpen24Hours: true }), null);
  });

  it("evaluates regular hours", () => {
    const hours = week({});
    assert.equal(isOpenAt(hours, 1, at("08:59")), false);
    assert.equal(isOpenAt(hours, 1, at("09:00")), true);
    assert.equal(isOpenAt(hours, 1, at("20:59")), true);
    assert.equal(isOpenAt(hours, 1, at("21:00")), false);
  });

  it("keeps late shops open past midnight on the previous day's hours", () => {
    const hours = week({ isClosed: true }, { 5: { isClosed: false, opensAt: "18:00", closesAt: "02:00" } });
    assert.equal(isOpenAt(hours, 5, at("23:30")), true);
    assert.equal(isOpenAt(hours, 6, at("01:59")), true);
    assert.equal(isOpenAt(hours, 6, at("02:00")), false);
    assert.equal(isOpenAt(hours, 5, at("01:00")), false);
  });

  it("treats 24-hour days as open all day, including the last minute", () => {
    const hours = week({ isOpen24Hours: true });
    assert.equal(isOpenAt(hours, 3, at("00:00")), true);
    assert.equal(isOpenAt(hours, 3, at("23:59")), true);
    assert.equal(describeOpenStatus(hours, 3, at("04:00")), "Open 24 hours");
  });

  it("never treats a closed day as open, even with the 24-hour flag", () => {
    const hours = week({}, { 0: { isClosed: true, isOpen24Hours: true } });
    assert.equal(isOpenAt(hours, 0, at("12:00")), false);
  });

  it("tells customers when the shop closes or opens next", () => {
    const hours = week({}, { 0: { isClosed: true } });
    assert.equal(describeOpenStatus(hours, 1, at("10:00")), "Open until 9:00 PM");
    assert.equal(describeOpenStatus(hours, 1, at("07:00")), "Opens at 9:00 AM");
    assert.equal(describeOpenStatus(hours, 1, at("22:00")), "Opens tomorrow at 9:00 AM");
    assert.equal(describeOpenStatus(hours, 6, at("22:00")), "Opens Monday at 9:00 AM");
    assert.equal(describeOpenStatus(week({ isClosed: true }), 2, at("10:00")), "Closed");
  });

  it("summarizes in shop-local time regardless of the server clock", () => {
    // 2026-10-14T20:00Z is Thursday 01:30 in Asia/Kolkata.
    const instant = new Date("2026-10-14T20:00:00Z");
    assert.deepEqual(shopClock(instant), { dayOfWeek: 4, minuteOfDay: at("01:30") });
    const late = week({ isClosed: true }, { 3: { isClosed: false, opensAt: "18:00", closesAt: "02:00" } });
    const summary = summarizeBusinessHours(late, instant);
    assert.equal(summary.openNow, true);
    assert.equal(summary.openStatusLabel, "Open until 2:00 AM");
    assert.equal(summary.todayHoursLabel, "Closed");
    assert.equal(summarizeBusinessHours(week({ isOpen24Hours: true }), instant).isOpen24x7, true);
  });
});
