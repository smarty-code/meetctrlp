import {
  ApiError,
  completeDocumentUpload,
  createDocumentIntent,
  deleteGuestDocument,
  uploadToPresignedUrl,
  type GuestDocumentDto,
} from "./cloud"
import { cacheUploadedFile } from "./file-store"

/** Mirrors the server's per-order cap (MAX_GUEST_FILES). */
export const MAX_DOCUMENTS_PER_ORDER = 10
export const MAX_FILE_SIZE = 50 * 1024 * 1024
/** Parallel uploads per batch; more than this mostly competes for a phone's uplink. */
export const UPLOAD_CONCURRENCY = 3
/** Tries for the server-side file check, which a serverless host can drop while scaling. */
const COMPLETE_ATTEMPTS = 3

type PrintableMime = GuestDocumentDto["mimeType"]

const EXTENSION_MIME: Record<string, PrintableMime> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
}

// Gallery formats the browser can usually decode and we re-encode as JPEG.
const CONVERTIBLE_IMAGE_EXTENSIONS = new Set(["heic", "heif", "webp", "gif", "avif", "bmp"])
const MAX_IMAGE_EDGE = 4000

function extensionOf(name: string) {
  return /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? ""
}

function printableMime(type: string): PrintableMime | null {
  const lowered = type.toLowerCase()
  if (lowered === "image/jpg") return "image/jpeg"
  return lowered === "application/pdf" || lowered === "image/jpeg" || lowered === "image/png"
    ? lowered
    : null
}

async function sniffMime(file: File): Promise<PrintableMime | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "application/pdf"
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg"
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png"
  } catch {}
  return null
}

function isConvertibleImage(file: File) {
  return (
    (file.type.startsWith("image/") && !printableMime(file.type)) ||
    CONVERTIBLE_IMAGE_EXTENSIONS.has(extensionOf(file.name))
  )
}

/** A synchronous check for files that can never be printed, shown before any upload starts. */
export function validateSelectedFile(file: File): string | null {
  const extension = extensionOf(file.name)
  if (/^(docx?|pptx?)$/.test(extension)) return "Word and PowerPoint files are not supported yet"
  if (file.size === 0) return "File is empty"
  if (file.size > MAX_FILE_SIZE) return "Exceeds 50MB limit"
  const knownType = printableMime(file.type) || EXTENSION_MIME[extension]
  // Some Android gallery pickers hand over files with no extension and no type; sniff those later.
  if (!knownType && !isConvertibleImage(file) && (file.type || extension)) return "Unsupported format"
  return null
}

async function convertImageToJpeg(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("This image format can't be opened here. Upload a JPG, PNG, or PDF.")
  }
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("Could not prepare this image for printing")
  }
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
  if (!blob) throw new Error("Could not prepare this image for printing")
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image"
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified })
}

/** Resolves the printable MIME type, converting gallery images (HEIC, WebP, ...) to JPEG. */
async function prepareFileForUpload(file: File): Promise<{ file: File; mimeType: PrintableMime }> {
  const mimeType =
    printableMime(file.type) || EXTENSION_MIME[extensionOf(file.name)] || (await sniffMime(file))
  if (mimeType) return { file, mimeType }
  if (isConvertibleImage(file)) {
    const converted = await convertImageToJpeg(file)
    if (converted.size > MAX_FILE_SIZE) throw new Error("Exceeds 50MB limit")
    return { file: converted, mimeType: "image/jpeg" }
  }
  throw new Error("Unsupported format")
}

async function putWithRetry(uploadUrl: string, file: File, mimeType: string, onProgress: (percent: number) => void) {
  try {
    await uploadToPresignedUrl(uploadUrl, file, mimeType, onProgress)
  } catch {
    // Mobile uplinks drop often; one retry covers most transient failures.
    onProgress(0)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await uploadToPresignedUrl(uploadUrl, file, mimeType, onProgress)
  }
}

/** A dropped connection, timeout, rate limit, or server error, as opposed to a file the server rejected. */
function isTransientFailure(error: unknown) {
  if (!(error instanceof ApiError)) return true
  return error.status === 408 || error.status === 429 || error.status >= 500
}

/**
 * `complete` is idempotent: a document that is already READY is returned as is. So a cold start,
 * a 429/5xx while instances scale, or a lost response is retried instead of discarding an upload
 * that already reached storage. A 400 means the file itself is unusable and is not retried.
 */
async function completeWithRetry(docId: string) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await completeDocumentUpload(docId)
    } catch (error) {
      if (attempt >= COMPLETE_ATTEMPTS || !isTransientFailure(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
    }
  }
}

/**
 * Uploads one file into the guest cart: intent -> storage PUT -> server inspection.
 * On failure the server-side intent is discarded so it does not hold a cart slot.
 */
export async function uploadGuestFile(
  source: File,
  onProgress: (percent: number) => void,
): Promise<{ document: GuestDocumentDto; file: File }> {
  const { file, mimeType } = await prepareFileForUpload(source)
  const intent = await createDocumentIntent({
    originalFilename: file.name,
    mimeType,
    fileSizeBytes: file.size,
  })
  try {
    await putWithRetry(intent.uploadUrl, file, intent.document.mimeType, onProgress)
    const document = await completeWithRetry(intent.document.id)
    cacheUploadedFile(document.id, file)
    return { document, file }
  } catch (error) {
    void deleteGuestDocument(intent.document.id).catch(() => undefined)
    throw error
  }
}

/** Runs `worker` over `items` with at most `limit` in flight. `worker` must not throw. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next]
      next += 1
      await worker(item)
    }
  })
  await Promise.all(runners)
}
