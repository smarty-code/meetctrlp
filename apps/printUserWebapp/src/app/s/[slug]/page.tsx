"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "../../../components/mobile-header"
import { HeroSection } from "../../../components/hero-section"
import { DocumentsUploadCard } from "../../../components/documents-upload-card"
import { PromiseSection } from "../../../components/promise-section"
import { FAQSection } from "../../../components/faq-section"
import { BrandFooter } from "../../../components/brand-footer"
import { FloatingOrderIndicator } from "../../../components/floating-order-indicator"
import { cacheUploadedFile, getCachedFileUrl, restoreCachedFile } from "../../../lib/file-store"
import { Info } from "lucide-react"
import { ShopInfoDrawer } from "../../../components/shop-info-drawer"
import { faqList } from "../../../data/mock-shop"
import { UploadedFileItem } from "../../../types/upload"
import { useShopSession } from "../../../components/shop-session-provider"
import { deleteGuestDocument, fetchGuestSession } from "../../../lib/cloud"
import {
  MAX_DOCUMENTS_PER_ORDER,
  UPLOAD_CONCURRENCY,
  runWithConcurrency,
  uploadGuestFile,
  validateSelectedFile,
} from "../../../lib/guest-upload"

export default function ShopUploadPage() {
  const router = useRouter()
  const { shop, routes } = useShopSession()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])
  const [notification, setNotification] = useState<string | null>(null)
  const [isShopInfoOpen, setIsShopInfoOpen] = useState(false)
  const isUploadingOverall = uploadedFiles.some((file) => file.status === "uploading")

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  // The server cart is the source of truth: show files already in it (e.g. after a reload or
  // coming back from customize) so the list, the cap, and the order all agree.
  useEffect(() => {
    let cancelled = false
    void fetchGuestSession()
      .then(async ({ session }) => {
        const ready = session.documents.filter((document) => document.status === "READY")
        const restored = await Promise.all(
          ready.map(async (document): Promise<UploadedFileItem> => {
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
          }),
        )
        if (cancelled) return
        setUploadedFiles((prev) => [
          ...restored.filter((item) => !prev.some((file) => file.id === item.id)),
          ...prev,
        ])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const updateFile = (id: string, patch: Partial<UploadedFileItem>) => {
    setUploadedFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...patch } : file)))
  }

  const runUpload = async (items: UploadedFileItem[]) => {
    let succeeded = 0
    await runWithConcurrency(items, UPLOAD_CONCURRENCY, async (item) => {
      if (!item.file) return
      try {
        const { document, file } = await uploadGuestFile(item.file, (progress) =>
          updateFile(item.id, { progress }),
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
        })
      } catch (error) {
        updateFile(item.id, {
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Upload failed",
        })
      }
    })
    return succeeded
  }

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return

    let remainingSlots =
      MAX_DOCUMENTS_PER_ORDER - uploadedFiles.filter((file) => file.status !== "error").length
    const newItems: UploadedFileItem[] = Array.from(files).map((file, idx) => {
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

    setUploadedFiles((prev) => [...prev, ...newItems])
    const validNewItems = newItems.filter((item) => item.status === "uploading")
    if (validNewItems.length === 0) return
    void runUpload(validNewItems).then((succeeded) => {
      showToast(
        succeeded < validNewItems.length
          ? `${succeeded} of ${validNewItems.length} documents uploaded`
          : `${succeeded} document${succeeded > 1 ? "s" : ""} uploaded`,
      )
    })
  }

  const handleRemoveFile = (fileId: string) => {
    const target = uploadedFiles.find((file) => file.id === fileId)
    // An in-flight upload would land in the cart after being hidden here; let it finish first.
    if (!target || target.status === "uploading") return
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId))
    if (target.status === "success") {
      void deleteGuestDocument(fileId).catch(() => undefined)
    }
  }

  const handleRetryFile = (fileId: string) => {
    const target = uploadedFiles.find((file) => file.id === fileId)
    if (!target?.file) return
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
    }
    updateFile(fileId, retried)
    void runUpload([retried])
  }

  const handleContinueToConfig = () => {
    if (isUploadingOverall) {
      showToast("Wait for uploads to finish")
      return
    }
    const validFiles = uploadedFiles.filter((file) => file.status === "success")
    if (validFiles.length === 0) return
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
    router.push(routes.customize)
  }

  const isAvailable = shop.status === "OPEN" || shop.status === "BUSY"
  // The hours label only applies to a shop that is running; a paused shop is simply closed.
  const hoursStatus =
    isAvailable || shop.status === "CLOSED"
      ? shop.openStatusLabel || (isAvailable ? "Open" : "Closed")
      : "Closed"
  const hasUploadedFiles = uploadedFiles.some((file) => file.status === "success")

  return (
    <div className="flex min-h-screen flex-col bg-paper selection:bg-macaw-blue selection:text-paper">
      <main
        className={`relative flex min-h-screen w-full flex-col bg-paper ${
          hasUploadedFiles ? "pb-24 md:pb-12" : "pb-0"
        }`}
      >
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
          uploadedFiles={uploadedFiles}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveFile}
          onRetryFile={handleRetryFile}
          isUploadingOverall={isUploadingOverall}
        />
        <PromiseSection />
        <FAQSection items={faqList} />
        <BrandFooter />
        <FloatingOrderIndicator files={uploadedFiles} onContinue={handleContinueToConfig} />
        <ShopInfoDrawer
          isOpen={isShopInfoOpen}
          onClose={() => setIsShopInfoOpen(false)}
          shop={shop}
        />
      </main>
    </div>
  )
}
