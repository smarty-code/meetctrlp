"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "../../../components/mobile-header"
import { HeroSection } from "../../../components/hero-section"
import { DocumentsUploadCard } from "../../../components/documents-upload-card"
import { PromiseSection } from "../../../components/promise-section"
import { FAQSection } from "../../../components/faq-section"
import { BrandFooter } from "../../../components/brand-footer"
import {
  cacheUploadedFile,
  getCachedFileUrl,
  removeCachedFile,
  removeCachedFiles,
  restoreCachedFile,
} from "../../../lib/file-store"
import { Info } from "lucide-react"
import { ShopInfoDrawer } from "../../../components/shop-info-drawer"
import { VideoCard } from "../../../components/video-card"
import { faqList } from "../../../data/mock-shop"
import { UploadedFileItem } from "../../../types/upload"
import { useShopSession } from "../../../components/shop-session-provider"
import {
  clearGuestCart,
  deleteGuestDocument,
  isAlreadyOrderedError,
  loadGuestSession,
  type GuestDocumentDto,
} from "../../../lib/cloud"
import { clearStoredCart } from "../../../lib/local-cart"
import {
  MAX_DOCUMENTS_PER_ORDER,
  UPLOAD_CONCURRENCY,
  isUploadCancelled,
  runWithConcurrency,
  uploadGuestFile,
  validateSelectedFile,
} from "../../../lib/guest-upload"

/** Long enough for the upload button to show a full bar before the page moves on. */
const AUTO_CONTINUE_DELAY_MS = 700

/** Hands the uploaded files to the customize page, which shows them before the server cart loads. */
function stashUploadedFiles(files: UploadedFileItem[]) {
  const validFiles = files.filter((file) => file.status === "success")
  validFiles.forEach((file) => {
    if (file.file) cacheUploadedFile(file.id, file.file)
  })
  window.sessionStorage.setItem(
    "ctrlp-uploaded-files",
    JSON.stringify(
      validFiles.map(({ id, name, size, type, pageCount }) => ({
        id,
        name,
        size,
        type,
        pageCount,
        previewUrl: getCachedFileUrl(id) || undefined,
      })),
    ),
  )
}

type ServerCart = { restored: UploadedFileItem[]; startedAt: number }

/** The server cart's ready documents, with cached files for previews. */
async function readServerCart(fresh: boolean): Promise<ServerCart> {
  const startedAt = Date.now()
  const session = await loadGuestSession({ fresh })
  const restored = await Promise.all(
    session.documents.filter((document) => document.status === "READY").map(toUploadedItem),
  )
  return { restored, startedAt }
}

async function toUploadedItem(document: GuestDocumentDto): Promise<UploadedFileItem> {
  const cached = await restoreCachedFile(document.id)
  return {
    id: document.id,
    file: cached?.file,
    name: document.originalFilename,
    size: document.fileSizeBytes,
    type: document.mimeType,
    pageCount: document.pageCount ?? undefined,
    progress: 100,
    status: "success",
    previewUrl: cached?.url,
  }
}

export default function ShopUploadPage() {
  const router = useRouter()
  const { shop, routes } = useShopSession()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])
  const [uploadRound, setUploadRound] = useState(0)
  const [notification, setNotification] = useState<string | null>(null)
  const [isShopInfoOpen, setIsShopInfoOpen] = useState(false)
  const [isCartLoading, setIsCartLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)
  const [pendingRemovals, setPendingRemovals] = useState(0)
  // Set when an upload batch ends with every file in the cart. Removing, clearing, cancelling and
  // a failure clear it, so only a clean batch moves on by itself; otherwise Continue is there.
  const [autoContinue, setAutoContinue] = useState(false)
  // One per picked file, made before it starts, so Cancel and Clear all also stop queued files.
  const controllers = useRef(new Map<string, AbortController>())

  const isUploadingOverall = uploadedFiles.some((file) => file.status === "uploading")
  const isReadyToContinue =
    autoContinue &&
    !isUploadingOverall &&
    !isClearing &&
    pendingRemovals === 0 &&
    uploadedFiles.length > 0 &&
    uploadedFiles.every((file) => file.status === "success")
  const canContinue =
    !isUploadingOverall &&
    !isClearing &&
    pendingRemovals === 0 &&
    uploadedFiles.some((file) => file.status === "success")

  // Byte-weighted so one large PDF is not drowned out by a few small photos. Held below 100
  // until the server accepts every file, since storage reaching 100% is not the last step.
  const roundFiles = uploadedFiles.filter(
    (file) => file.uploadRound === uploadRound && file.status !== "error",
  )
  const roundBytes = roundFiles.reduce((total, file) => total + file.size, 0)
  const sentBytes = roundFiles.reduce(
    (total, file) => total + (file.size * (file.status === "success" ? 100 : file.progress)) / 100,
    0,
  )
  const uploadProgress = isReadyToContinue
    ? 100
    : roundBytes > 0
      ? Math.min(99, Math.floor((sentBytes / roundBytes) * 100))
      : 0
  // Every byte is in storage and only the server's file check is left. On a serverless host that
  // can include a cold start, so the button says what it is waiting for instead of sitting at 99%.
  const isCheckingUploads =
    isUploadingOverall &&
    roundFiles.every((file) => file.status === "success" || file.progress >= 100)

  const goToCustomize = useCallback(() => {
    stashUploadedFiles(uploadedFiles)
    router.push(routes.customize)
  }, [uploadedFiles, router, routes.customize])

  useEffect(() => {
    if (!isReadyToContinue) return
    const timer = window.setTimeout(goToCustomize, AUTO_CONTINUE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [isReadyToContinue, goToCustomize])

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  // The server cart is the source of truth for which documents are listed (after a reload, coming
  // back from customize, or a failed delete), so the list, the cap and the order agree. Files
  // picked here that are uploading or failed stay beside it, as does one that finished after
  // this read began.
  const applyServerCart = ({ restored, startedAt }: ServerCart) => {
    setUploadedFiles((prev) => {
      const serverIds = new Set(restored.map((item) => item.id))
      const fromServer = restored.map((item) => {
        const local = prev.find((file) => file.id === item.id)
        return local
          ? {
              ...item,
              file: local.file ?? item.file,
              previewUrl: local.previewUrl ?? item.previewUrl,
              uploadRound: local.uploadRound,
            }
          : item
      })
      const localOnly = prev.filter(
        (file) =>
          !serverIds.has(file.id) &&
          (file.status !== "success" || (file.completedAt ?? 0) > startedAt),
      )
      return [...fromServer, ...localOnly]
    })
  }

  const syncFromServer = (fresh: boolean) => readServerCart(fresh).then(applyServerCart)

  // Picking stays off until the cart is known, so the 10-file cap counts what is already in it.
  useEffect(() => {
    let cancelled = false
    void readServerCart(false)
      .then((cart) => {
        if (!cancelled) applyServerCart(cart)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsCartLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Runs once on mount; later reads follow a failed delete or clear.
  }, [])

  const updateFile = (id: string, patch: Partial<UploadedFileItem>) => {
    setUploadedFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...patch } : file)))
  }

  const dropFiles = (ids: string[]) => {
    const dropped = new Set(ids)
    setUploadedFiles((prev) => prev.filter((file) => !dropped.has(file.id)))
  }

  const runUpload = async (items: UploadedFileItem[]) => {
    let succeeded = 0
    let cancelled = 0
    await runWithConcurrency(items, UPLOAD_CONCURRENCY, async (item) => {
      const controller = controllers.current.get(item.id)
      if (!item.file || !controller) return
      try {
        const { document, file } = await uploadGuestFile(
          item.file,
          (progress) => updateFile(item.id, { progress }),
          controller.signal,
        )
        succeeded += 1
        updateFile(item.id, {
          id: document.id,
          file,
          name: document.originalFilename,
          size: document.fileSizeBytes,
          progress: 100,
          status: "success",
          errorMessage: undefined,
          pageCount: document.pageCount ?? undefined,
          type: document.mimeType,
          previewUrl: getCachedFileUrl(document.id) || item.previewUrl,
          completedAt: Date.now(),
        })
      } catch (error) {
        if (isUploadCancelled(error)) {
          // Already off the list; the upload deleted its own cart entry.
          cancelled += 1
          dropFiles([item.id])
          return
        }
        updateFile(item.id, {
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Upload failed",
        })
      } finally {
        controllers.current.delete(item.id)
      }
    })
    return { succeeded, cancelled }
  }

  /** Starts uploads. A batch that lands in the cart in full moves the order on by itself. */
  const startUploads = (items: UploadedFileItem[]) => {
    for (const item of items) controllers.current.set(item.id, new AbortController())
    setAutoContinue(false)
    void runUpload(items).then(({ succeeded, cancelled }) => {
      if (cancelled > 0) return
      if (succeeded === items.length) {
        setAutoContinue(true)
      } else {
        showToast(`${succeeded} of ${items.length} documents uploaded`)
      }
    })
  }

  // A new round starts whenever nothing is in flight; a retry sent mid-round joins it, so the
  // button's combined percentage keeps counting up instead of restarting.
  const startUploadRound = () => {
    const round = isUploadingOverall ? uploadRound : uploadRound + 1
    setUploadRound(round)
    router.prefetch(routes.customize)
    return round
  }

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0 || isCartLoading || isClearing) return

    let remainingSlots =
      MAX_DOCUMENTS_PER_ORDER - uploadedFiles.filter((file) => file.status !== "error").length
    const picked: UploadedFileItem[] = Array.from(files).map((file, idx) => {
      const id = `file_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`
      let errorMessage = validateSelectedFile(file) ?? undefined
      if (!errorMessage) {
        if (remainingSlots > 0) {
          remainingSlots -= 1
        } else {
          errorMessage = `Up to ${MAX_DOCUMENTS_PER_ORDER} documents per order`
        }
      }
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        progress: 0,
        status: errorMessage ? "error" : "uploading",
        errorMessage,
      }
    })
    const round = picked.some((item) => item.status === "uploading")
      ? startUploadRound()
      : uploadRound
    const newItems = picked.map((item) => ({ ...item, uploadRound: round }))

    setUploadedFiles((prev) => [...prev, ...newItems])
    const validNewItems = newItems.filter((item) => item.status === "uploading")
    if (validNewItems.length === 0) {
      setAutoContinue(false)
      return
    }
    startUploads(validNewItems)
  }

  /** Stops uploads in flight or queued, and takes them off the list. */
  const cancelUploads = (ids: string[]) => {
    for (const id of ids) controllers.current.get(id)?.abort()
    dropFiles(ids)
  }

  const handleCancelUploads = () => {
    setAutoContinue(false)
    cancelUploads(uploadedFiles.filter((file) => file.status === "uploading").map((file) => file.id))
  }

  const handleRemoveFile = async (fileId: string) => {
    const index = uploadedFiles.findIndex((file) => file.id === fileId)
    const target = uploadedFiles[index]
    if (!target) return
    setAutoContinue(false)
    if (target.status === "uploading") {
      cancelUploads([fileId])
      return
    }
    dropFiles([fileId])
    // A failed upload already discarded its cart entry; only a document in the cart needs the server.
    if (target.status !== "success") return

    setPendingRemovals((count) => count + 1)
    try {
      await deleteGuestDocument(fileId)
      void removeCachedFile(fileId)
    } catch (error) {
      if (isAlreadyOrderedError(error)) {
        showToast(`${target.name} is already in your order`)
        void syncFromServer(true).catch(() => undefined)
        return
      }
      // Put it back where it was: the server still has it, so it would still be ordered.
      setUploadedFiles((prev) =>
        prev.some((file) => file.id === fileId)
          ? prev
          : [...prev.slice(0, index), target, ...prev.slice(index)],
      )
      showToast(`Couldn't remove ${target.name}. Check your connection and try again.`)
    } finally {
      setPendingRemovals((count) => count - 1)
    }
  }

  const handleClearAll = async () => {
    const previous = uploadedFiles
    setAutoContinue(false)
    setIsClearing(true)
    // Stop every upload first, so none lands in the cart after it is emptied.
    for (const controller of controllers.current.values()) controller.abort()
    setUploadedFiles([])
    try {
      await clearGuestCart()
      clearStoredCart()
      void removeCachedFiles(
        previous.filter((file) => file.status === "success").map((file) => file.id),
      )
      showToast("All documents cleared")
    } catch {
      showToast("Couldn't clear your documents. Check your connection and try again.")
      await syncFromServer(true).catch(() =>
        setUploadedFiles(previous.filter((file) => file.status === "success")),
      )
    } finally {
      setIsClearing(false)
    }
  }

  const handleRetryFile = (fileId: string) => {
    const target = uploadedFiles.find((file) => file.id === fileId)
    if (!target?.file || isClearing) return
    const activeCount = uploadedFiles.filter(
      (file) => file.status !== "error" && file.id !== fileId,
    ).length
    if (activeCount >= MAX_DOCUMENTS_PER_ORDER) {
      showToast(`Up to ${MAX_DOCUMENTS_PER_ORDER} documents per order`)
      return
    }
    const retried: UploadedFileItem = {
      ...target,
      status: "uploading",
      progress: 0,
      errorMessage: undefined,
      uploadRound: startUploadRound(),
    }
    updateFile(fileId, retried)
    startUploads([retried])
  }

  const handleContinue = () => {
    if (canContinue) goToCustomize()
  }

  const isAvailable = shop.status === "OPEN" || shop.status === "BUSY"
  // The hours label only applies to a shop that is running; a paused shop is simply closed.
  const hoursStatus =
    isAvailable || shop.status === "CLOSED"
      ? shop.openStatusLabel || (isAvailable ? "Open" : "Closed")
      : "Closed"

  return (
    <div className="flex min-h-screen flex-col bg-paper selection:bg-macaw-blue selection:text-paper">
      <main className="relative flex min-h-screen w-full flex-col bg-paper">
        {notification && (
          <div className="animate-fadeIn fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-graphite/30 bg-midnight px-4 py-2 text-caption font-bold text-paper shadow-lg transition-all">
            {notification}
          </div>
        )}
        <MobileHeader onSearch={() => showToast("Search services coming soon")} />
        <HeroSection
          isAvailable={isAvailable}
          shopName={shop.name}
          stickerText="Print it. Pick it. Done."
        />
        <div className="mx-auto w-full max-w-xl px-4 pt-3 sm:max-w-2xl sm:px-6 md:max-w-3xl">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-graphite/20 bg-paper px-3.5 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`size-2.5 shrink-0 rounded-full ${
                  isAvailable ? "bg-ecto-green animate-pulse" : "bg-amber-500"
                }`}
                aria-hidden="true"
              />
              <span className="truncate text-caption font-bold text-midnight">
                Printing at {shop.name}
              </span>
              <span className="hidden text-[11px] font-bold text-ash sm:inline-block">
                • {hoursStatus}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsShopInfoOpen(true)}
              aria-label={`Open shop information for ${shop.name}`}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-lingot-lime bg-eel-light/30 px-2.5 py-1 text-caption font-bold text-midnight transition-colors hover:bg-eel-light/60 active:translate-y-px"
            >
              <Info className="size-3.5 text-midnight" />
              <span>Shop Info</span>
            </button>
          </div>
        </div>
        <DocumentsUploadCard
          isAvailable={isAvailable}
          startingPrice={shop.startingPriceA4}
          shopName={shop.name}
          uploadedFiles={uploadedFiles}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={(fileId) => void handleRemoveFile(fileId)}
          onRetryFile={handleRetryFile}
          onCancelUploads={handleCancelUploads}
          onClearAll={() => void handleClearAll()}
          onContinue={handleContinue}
          canContinue={canContinue}
          isCartLoading={isCartLoading}
          isClearing={isClearing}
          isUploadingOverall={isUploadingOverall}
          isUploadComplete={isReadyToContinue}
          isCheckingUploads={isCheckingUploads}
          uploadProgress={uploadProgress}
          uploadingCount={roundFiles.length}
        />
        <VideoCard
          caption={`Watch how printing works at ${shop.name}`}
        />
        <PromiseSection />
        <FAQSection items={faqList} />
        <BrandFooter />
        <ShopInfoDrawer
          isOpen={isShopInfoOpen}
          onClose={() => setIsShopInfoOpen(false)}
          shop={shop}
        />
      </main>
    </div>
  )
}
