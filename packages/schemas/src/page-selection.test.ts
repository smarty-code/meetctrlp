import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPageRanges, parsePageSelection } from "./page-selection.ts";

describe("parsePageSelection", () => {
  it("reads all pages, lists and ranges, and returns them merged", () => {
    assert.deepEqual(parsePageSelection("all", 3), { ok: true, pages: [1, 2, 3], canonical: "all" });
    assert.deepEqual(parsePageSelection("", 2), { ok: true, pages: [1, 2], canonical: "all" });
    assert.deepEqual(parsePageSelection(" 5-8, 1 ,3,3 ,6", 10), { ok: true, pages: [1, 3, 5, 6, 7, 8], canonical: "1,3,5-8" });
    assert.deepEqual(parsePageSelection("2 - 4,", 4), { ok: true, pages: [2, 3, 4], canonical: "2-4" });
  });

  it("refuses the whole selection when any token is out of range or malformed", () => {
    assert.equal(parsePageSelection("1,200", 10).ok, false);
    assert.equal(parsePageSelection("0", 10).ok, false);
    assert.equal(parsePageSelection("8-3", 10).ok, false);
    assert.equal(parsePageSelection("1-99", 10).ok, false);
    assert.equal(parsePageSelection("one", 10).ok, false);
    assert.equal(parsePageSelection("1;3", 10).ok, false);
    assert.equal(parsePageSelection(",", 10).ok, false);
    assert.equal(parsePageSelection("1", 0).ok, false);
  });
});

describe("formatPageRanges", () => {
  it("merges consecutive pages", () => {
    assert.equal(formatPageRanges([8, 1, 3, 5, 6, 7, 3]), "1,3,5-8");
    assert.equal(formatPageRanges([4]), "4");
    assert.equal(formatPageRanges([]), "");
  });
});
