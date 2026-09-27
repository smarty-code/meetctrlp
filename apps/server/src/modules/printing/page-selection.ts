const rangePattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;

export function parsePageSelection(selection: string | null | undefined, totalPages: number) {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new Error("page count must be positive");
  }

  const text = selection?.trim() ?? "";
  if (text.length === 0 || text.toLowerCase() === "all") {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (!rangePattern.test(text)) {
    throw new Error("Invalid page selection format. Expected e.g. '1,3,5-8'.");
  }

  const pages = new Set<number>();
  for (const part of text.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startText, endText] = trimmed.split("-");
      const start = Number(startText);
      const end = Number(endText);
      if (start < 1 || end > totalPages || start > end) {
        throw new Error(`Page range '${trimmed}' is outside 1..${totalPages}.`);
      }

      for (let page = start; page <= end; page += 1) {
        pages.add(page);
      }
    } else {
      const page = Number(trimmed);
      if (page < 1 || page > totalPages) {
        throw new Error(`Page ${page} is outside 1..${totalPages}.`);
      }

      pages.add(page);
    }
  }

  return [...pages].sort((left, right) => left - right);
}
