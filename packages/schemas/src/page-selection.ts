// One page-selection grammar for the cart, the quote and the printer. It is strict: a selection
// names only real pages of the document or it is refused, so the pages a customer is billed for
// are exactly the pages that print. No zod import, so it is cheap to load anywhere.

export type PageSelectionResult =
  | {
      ok: true;
      /** Sorted, without repeats. */
      pages: number[];
      /** `"all"` for every page, otherwise merged ranges such as `"1,3,5-8"`. */
      canonical: string;
    }
  | { ok: false; reason: string };

const TOKEN = /^(\d+)(?:\s*-\s*(\d+))?$/;

/** `[1, 3, 5, 6, 7, 8]` → `"1,3,5-8"`. */
export function formatPageRanges(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((left, right) => left - right);
  const parts: string[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index];
    let end = start;
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      index += 1;
      end = sorted[index];
    }
    parts.push(start === end ? String(start) : `${start}-${end}`);
  }
  return parts.join(",");
}

/**
 * Parses `"all"` or `""` (every page), or a list such as `"1,3,5-8"` against `pageCount`. Spaces
 * around tokens and empty tokens (`"1,3,"`) are ignored. Any token that is not a page or a range
 * within 1..pageCount fails the whole selection.
 */
export function parsePageSelection(selection: string | null | undefined, pageCount: number): PageSelectionResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return { ok: false, reason: "page count must be positive" };
  }

  const text = selection?.trim() ?? "";
  if (text === "" || text.toLowerCase() === "all") {
    return { ok: true, pages: Array.from({ length: pageCount }, (_, index) => index + 1), canonical: "all" };
  }

  const pages = new Set<number>();
  for (const raw of text.split(",")) {
    const token = raw.trim();
    if (!token) {
      continue;
    }
    const match = TOKEN.exec(token);
    if (!match) {
      return { ok: false, reason: `"${token}" is not a page or a range such as 5-8` };
    }
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (start < 1 || end > pageCount || start > end) {
      return { ok: false, reason: `"${token}" is outside pages 1 to ${pageCount}` };
    }
    for (let page = start; page <= end; page += 1) {
      pages.add(page);
    }
  }

  if (pages.size === 0) {
    return { ok: false, reason: "select at least one page" };
  }
  const sorted = [...pages].sort((left, right) => left - right);
  return { ok: true, pages: sorted, canonical: formatPageRanges(sorted) };
}
