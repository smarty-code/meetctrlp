import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deflateSync } from "node:zlib";

import { countPdfPages } from "./pdf-page-count.ts";

function pageDicts(count: number, firstNumber: number) {
  return Array.from({ length: count }, (_, index) => [
    firstNumber + index,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>",
  ] as [number, string]);
}

function kids(count: number, firstNumber: number) {
  return Array.from({ length: count }, (_, index) => `${firstNumber + index} 0 R`).join(" ");
}

function plainPdf(pageCount: number) {
  const objects: Array<[number, string]> = [
    [1, "<< /Type /Catalog /Pages 2 0 R >>"],
    [2, `<< /Type /Pages /Kids [${kids(pageCount, 3)}] /Count ${pageCount} >>`],
    ...pageDicts(pageCount, 3),
  ];
  const body = objects.map(([number, dict]) => `${number} 0 obj\n${dict}\nendobj\n`).join("");
  return Buffer.from(`%PDF-1.4\n${body}trailer\n<< /Root 1 0 R >>\n%%EOF\n`, "latin1");
}

function objectStreamPdf(pageCount: number) {
  const objects: Array<[number, string]> = [
    [1, "<< /Type /Catalog /Pages 2 0 R >>"],
    [2, `<< /Type /Pages /Kids [${kids(pageCount, 3)}] /Count ${pageCount} >>`],
    ...pageDicts(pageCount, 3),
  ];
  let header = "";
  let data = "";
  for (const [number, dict] of objects) {
    header += `${number} ${data.length} `;
    data += `${dict}\n`;
  }
  const packed = deflateSync(Buffer.from(header + data, "latin1"));
  const streamNumber = pageCount + 3;
  return Buffer.concat([
    Buffer.from(
      `%PDF-1.5\n${streamNumber} 0 obj\n<< /Type /ObjStm /N ${objects.length} /First ${header.length} /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`,
      "latin1",
    ),
    packed,
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"),
  ]);
}

describe("countPdfPages", () => {
  it("counts pages in an uncompressed PDF", () => {
    assert.equal(countPdfPages(plainPdf(4)), 4);
  });

  it("counts pages stored in compressed object streams", () => {
    assert.equal(countPdfPages(objectStreamPdf(3)), 3);
    assert.equal(countPdfPages(objectStreamPdf(12)), 12);
  });

  it("uses the latest Pages tree after an incremental update", () => {
    const updated = Buffer.concat([
      plainPdf(2),
      Buffer.from(
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R 9 0 R] /Count 3 >>\nendobj\n9 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n%%EOF\n",
        "latin1",
      ),
    ]);
    assert.equal(countPdfPages(updated), 3);
  });

  it("returns 0 when no pages are present", () => {
    assert.equal(countPdfPages(Buffer.from("%PDF-1.4\n%%EOF\n", "latin1")), 0);
  });
});
