import { inflateSync, constants as zlibConstants } from "node:zlib";

/**
 * Counts pages in a PDF without a full parser.
 *
 * PDF 1.5+ writers (Acrobat, Word, pdf-lib, qpdf, scanner apps) often store the
 * Catalog/Pages/Page dictionaries inside FlateDecode object streams, where a raw
 * byte scan cannot see them. We collect every object (raw and from inflated
 * object streams; later definitions win, matching incremental-update semantics),
 * then read `/Count` from the Pages tree referenced by the Catalog.
 */
export function countPdfPages(bytes: Buffer): number {
  const text = bytes.toString("latin1");
  const objects = new Map<number, string>();

  for (const match of text.matchAll(/(\d+)\s+\d+\s+obj\b([\s\S]*?)\bendobj\b/g)) {
    const objectNumber = Number(match[1]);
    const body = match[2];
    if (/\/Type\s*\/ObjStm\b/.test(body)) {
      const bodyStart = (match.index ?? 0) + match[0].length - "endobj".length - body.length;
      for (const [innerNumber, innerBody] of readObjectStream(bytes, bodyStart, body)) {
        objects.set(innerNumber, innerBody);
      }
      continue;
    }
    objects.set(objectNumber, body);
  }

  const fromCatalog = pageCountFromCatalog(objects);
  if (fromCatalog > 0) {
    return fromCatalog;
  }

  let pageObjects = 0;
  for (const body of objects.values()) {
    if (/\/Type\s*\/Page(?![a-zA-Z])/.test(body)) {
      pageObjects += 1;
    }
  }
  if (pageObjects > 0) {
    return pageObjects;
  }

  return text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
}

function pageCountFromCatalog(objects: Map<number, string>) {
  for (const body of objects.values()) {
    if (!/\/Type\s*\/Catalog\b/.test(body)) {
      continue;
    }
    const pagesRef = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(body);
    const pages = pagesRef ? objects.get(Number(pagesRef[1])) : undefined;
    const count = pages ? /\/Count\s+(\d+)/.exec(pages) : null;
    if (count) {
      return Number(count[1]);
    }
  }

  let rootCount = 0;
  for (const body of objects.values()) {
    if (/\/Type\s*\/Pages\b/.test(body) && !/\/Parent\s+\d+\s+\d+\s+R/.test(body)) {
      const count = /\/Count\s+(\d+)/.exec(body);
      rootCount = Math.max(rootCount, count ? Number(count[1]) : 0);
    }
  }
  return rootCount;
}

function readObjectStream(bytes: Buffer, bodyStart: number, body: string): Array<[number, string]> {
  if (!/\/Filter\s*\/FlateDecode\b/.test(body) || /\/DecodeParms\b/.test(body)) {
    return [];
  }
  const count = /\/N\s+(\d+)/.exec(body);
  const first = /\/First\s+(\d+)/.exec(body);
  const streamStart = /stream\r?\n/.exec(body);
  const streamEnd = body.lastIndexOf("endstream");
  if (!count || !first || !streamStart || streamEnd < 0) {
    return [];
  }

  // latin1 maps each byte to one char, so string offsets are byte offsets.
  const dataStart = bodyStart + streamStart.index + streamStart[0].length;
  const dataEnd = bodyStart + streamEnd;

  let decoded: string;
  try {
    decoded = inflateSync(bytes.subarray(dataStart, dataEnd), {
      finishFlush: zlibConstants.Z_SYNC_FLUSH,
    }).toString("latin1");
  } catch {
    return [];
  }

  const firstOffset = Number(first[1]);
  const header = decoded.slice(0, firstOffset).trim().split(/\s+/).map(Number);
  const entries: Array<[number, string]> = [];
  for (let index = 0; index + 1 < header.length && index / 2 < Number(count[1]); index += 2) {
    const start = firstOffset + header[index + 1];
    const end = index + 3 < header.length ? firstOffset + header[index + 3] : decoded.length;
    entries.push([header[index], decoded.slice(start, end)]);
  }
  return entries;
}
