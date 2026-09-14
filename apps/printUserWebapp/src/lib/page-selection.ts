export function parsePageSelection(expression: string, pageCount: number): number[] {
  const pages = new Set<number>();

  for (const token of expression.split(',')) {
    const value = token.trim();
    if (!value) continue;

    if (/^\d+$/.test(value)) {
      const page = Number(value);
      if (page >= 1 && page <= pageCount) pages.add(page);
      continue;
    }

    const range = value.match(/^(\d+)-(\d+)$/);
    if (!range) continue;
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start < 1 || end > pageCount || start > end) continue;
    for (let page = start; page <= end; page += 1) pages.add(page);
  }

  return [...pages].sort((a, b) => a - b);
}

export function isPageSelectionValid(expression: string, pageCount: number): boolean {
  if (!expression.trim()) return false;
  const pages = parsePageSelection(expression, pageCount);
  const tokens = expression.split(',').map((token) => token.trim()).filter(Boolean);
  return pages.length > 0 && tokens.every((token) => /^\d+$/.test(token) || /^\d+-\d+$/.test(token));
}