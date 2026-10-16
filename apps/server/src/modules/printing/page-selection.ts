import { parsePageSelection as parseSharedPageSelection } from "@ctrlp/schemas/page-selection";

/**
 * The pages a job prints. The same strict grammar the cart validates with
 * (@ctrlp/schemas/page-selection), so a selection the cart took always dispatches. Throws on an
 * invalid one.
 */
export function parsePageSelection(selection: string | null | undefined, totalPages: number) {
  const result = parseSharedPageSelection(selection, totalPages);
  if (!result.ok) {
    throw new Error(`Invalid page selection: ${result.reason}.`);
  }
  return result.pages;
}
