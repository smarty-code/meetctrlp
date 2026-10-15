import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DELTA_OVERLAP_MS, deltaStart, shopDateRange, shopDayStart } from "./board-model.ts";

describe("shop-time dates", () => {
  it("starts a shop day at 18:30 UTC the day before", () => {
    assert.equal(shopDayStart("2026-10-15").toISOString(), "2026-10-14T18:30:00.000Z");
  });

  it("includes the whole of the `to` day", () => {
    const range = shopDateRange("2026-10-15", "2026-10-15");
    assert.equal(range.start?.toISOString(), "2026-10-14T18:30:00.000Z");
    assert.equal(range.end?.toISOString(), "2026-10-15T18:30:00.000Z");
    assert.deepEqual(shopDateRange(), { start: undefined, end: undefined });
  });

  it("puts an order at 00:15 India time on that India day, not the UTC day before", () => {
    const placed = Date.parse("2026-10-14T18:45:00.000Z");
    const range = shopDateRange("2026-10-15", "2026-10-15");
    assert.ok(placed >= range.start!.getTime() && placed < range.end!.getTime());
  });
});

describe("board delta", () => {
  const now = Date.parse("2026-10-15T10:00:00.000Z");

  it("starts the overlap before the cursor", () => {
    assert.equal(deltaStart("2026-10-15T09:59:00.000Z", now)?.getTime(), Date.parse("2026-10-15T09:59:00.000Z") - DELTA_OVERLAP_MS);
  });

  it("falls back to the full board for missing, bad, future or stale cursors", () => {
    assert.equal(deltaStart(undefined, now), null);
    assert.equal(deltaStart("not a date", now), null);
    assert.equal(deltaStart("2026-10-15T11:00:00.000Z", now), null);
    assert.equal(deltaStart("2026-10-13T10:00:00.000Z", now), null);
  });
});
