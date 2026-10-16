import { ConfigurableDocument } from "../types/upload"
import {
  cloneConfiguration,
  customizeConfig,
  defaultPrintConfiguration,
} from "./customize-repository"
import { getCachedFile, getCachedFileUrl } from "../lib/file-store"

type DocumentInput = Pick<
  ConfigurableDocument,
  "id" | "name" | "size" | "type"
> & { previewUrl?: string; pageCount?: number }

export function mapFilesToConfigurationDocuments(
  files: DocumentInput[]
): ConfigurableDocument[] {
  return files.map((file) => {
    const cached = getCachedFile(file.id)
    const previewUrl =
      file.previewUrl || cached?.url || getCachedFileUrl(file.id)
    const realFile = cached?.file
    const isImage = file.type.startsWith("image/")

    return {
      ...file,
      file: realFile,
      previewUrl: previewUrl || undefined,
      pageCount: file.pageCount || (isImage ? 1 : customizeConfig.defaultPageCount),
      status: "ready",
      configuration: cloneConfiguration(defaultPrintConfiguration),
    }
  })
}

export function mapStoredFilesToDocuments(
  files: DocumentInput[],
  idPrefix: string
): ConfigurableDocument[] {
  return mapFilesToConfigurationDocuments(
    files.map((file, index) => ({
      ...file,
      id: file.id || `${idPrefix}-${index}`,
    }))
  )
}

export function copyConfigurationToDocument(
  configuration: ConfigurableDocument["configuration"],
  document: ConfigurableDocument
): ConfigurableDocument["configuration"] {
  const copied = cloneConfiguration(configuration)
  if (copied.pageSelection.mode === "selected") {
    copied.pageSelection.pages = copied.pageSelection.pages.filter(
      (page) => page <= document.pageCount
    )
  }
  return copied
}
