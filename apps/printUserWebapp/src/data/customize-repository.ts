import { ConfigurableDocument, PrintConfiguration } from "../types/upload"

export const customizeCopy = {
  title: "Customize prints",
  back: "Back to upload documents",
  addFiles: "Add files",
  preview: "Document preview",
  previousDocument: "Previous document",
  nextDocument: "Next document",
  selectDocument: "Select document",
  previewPage: "Preview page",
  remove: "Remove",
  copies: "Number of copies",
  copiesHint: "Applied to this document",
  decreaseCopies: "Decrease copies",
  increaseCopies: "Increase copies",
  colorLegend: "Choose print color",
  orientationLegend: "Page orientation",
  portrait: "Portrait",
  landscape: "Landscape",
  portraitHint: "3:4",
  landscapeHint: "4:3",
  paperLegend: "Paper size",
  standardPaper: "Standard paper",
  pageSelectionLegend: "Page selection",
  allPages: "All pages",
  selectedPages: "Selected pages",
  pagesToPrint: "Pages to print",
  pagePlaceholder: "1,3,5-8",
  pageError: (pageCount: number) =>
    `Use valid pages from 1 to ${pageCount}, such as 1,3,5-8.`,
  applyAll: "Apply this setting to all files",
  applyAllHint: "You can still adjust files individually.",
  apply: "Apply",
  emptyTitle: "No documents yet",
  emptyDescription: "Add a document to continue.",
  addDocument: "Add a document",
  orderSummary: "Order summary",
  totalPages: (count: number) => `Total ${count} pages`,
  updatingPrice: "Updating price...",
  continue: "Continue",
  reviewReady: "Review screen is ready for the next step.",
  settingsCopied: "Settings copied to all files",
  pages: (count: number) => `${count} ${count === 1 ? "page" : "pages"}`,
  paperSize: "A4",
  color: "Color",
  blackAndWhite: "B&W",
  perPage: (price: number) => `₹${price}/page`,
  fileMeta: (pageCount: number, size: string) => `${pageCount} pages · ${size}`,
  previewPageCount: (page: number, count: number) => `Page ${page} of ${count}`,
  documentPosition: (current: number, total: number) => `${current} / ${total}`,
  paperSizeHint: "Standard paper",
} as const

export const customizeConfig = {
  acceptedFileTypes: ".pdf,.jpg,.jpeg,.png,.doc,.docx,.ppt,.pptx",
  maxCopies: 20,
  pricePerPage: { bw: 3, color: 10 } as const,
  defaultPageCount: 3,
  additionalPageCount: 1,
  notificationDuration: 2500,
  priceUpdateDuration: 250,
} as const

export const defaultPrintConfiguration: PrintConfiguration = {
  copies: 1,
  colorMode: "bw",
  orientation: "portrait",
  paperSize: customizeCopy.paperSize,
  pageSelection: { mode: "all", expression: "", pages: [] },
}

export const mockConfigurationDocuments: ConfigurableDocument[] = [
  createMockDocument(
    "demo-resume",
    "Resume.pdf",
    245760,
    "application/pdf",
    customizeConfig.defaultPageCount
  ),
  createMockDocument(
    "demo-notes",
    "Lecture-notes.pdf",
    524288,
    "application/pdf",
    8
  ),
]

function createMockDocument(
  id: string,
  name: string,
  size: number,
  type: string,
  pageCount: number
): ConfigurableDocument {
  return {
    id,
    name,
    size,
    type,
    pageCount,
    status: "ready",
    configuration: cloneConfiguration(defaultPrintConfiguration),
  }
}

export function cloneConfiguration(
  configuration: PrintConfiguration
): PrintConfiguration {
  return {
    ...configuration,
    pageSelection: {
      ...configuration.pageSelection,
      pages: [...configuration.pageSelection.pages],
    },
  }
}
