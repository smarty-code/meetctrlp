"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "../../../components/mobile-header"
import { HeroSection } from "../../../components/hero-section"
import { DocumentsUploadCard } from "../../../components/documents-upload-card"
import { PromiseSection } from "../../../components/promise-section"
import { FAQSection } from "../../../components/faq-section"
import { BrandFooter } from "../../../components/brand-footer"
import { FloatingOrderIndicator } from "../../../components/floating-order-indicator"
import { cacheUploadedFile, getCachedFileUrl } from "../../../lib/file-store"
import { Info } from "lucide-react"
import { ShopInfoDrawer } from "../../../components/shop-info-drawer"
import { faqList } from "../../../data/mock-shop"
import { UploadedFileItem } from "../../../types/upload"
import { useShopSession } from "../../../components/shop-session-provider"
import {
  completeDocumentUpload,
  createDocumentIntent,
  deleteGuestDocument,
  uploadToPresignedUrl,
} from "../../../lib/cloud"

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"]
const MAX_FILE_SIZE = 50 * 1024 * 1024

async function uploadOneFile(
  file: File,
  id: string,
  onProgress: (percent: number) => void,
) {
  const intent = await createDocumentIntent({
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSizeBytes: file.size,
  })
  await uploadToPresignedUrl(intent.uploadUrl, file, intent.document.mimeType, onProgress)
  const completed = await completeDocumentUpload(intent.document.id)
  cacheUploadedFile(completed.id, file)
  return completed
}

export default function ShopUploadPage() {
  const router = useRouter()
  const { shop, routes } = useShopSession()
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])
  const [isUploadingOverall, setIsUploadingOverall] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [isShopInfoOpen, setIsShopInfoOpen] = useState(false)

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  const runUpload = async (items: UploadedFileItem[]) => {
    setIsUploadingOverall(true)
    await Promise.all(
      items.map(async (item) => {
        try {
          const completed = await uploadOneFile(item.file, item.id, (progress) => {
            setUploadedFiles((prev) =>
              prev.map((file) => (file.id === item.id ? { ...file, progress } : file)),
            )
          })
          setUploadedFiles((prev) =>
            prev.map((file) =>
              file.id === item.id
                ? {
                    ...file,
                    id: completed.id,
                    progress: 100,
                    status: "success",
                    pageCount: completed.pageCount ?? undefined,
                    type: completed.mimeType,
                    previewUrl: getCachedFileUrl(completed.id) || file.previewUrl,
                  }
                : file,
            ),
          )
        } catch (error) {
          setUploadedFiles((prev) =>
            prev.map((file) =>
              file.id === item.id
                ? {
                    ...file,
                    status: "error",
                    errorMessage: error instanceof Error ? error.message : "Upload failed",
                  }
                : file,
            ),
          )
        }
      }),
    )
    setIsUploadingOverall(false)
  }

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newItems: UploadedFileItem[] = Array.from(files).map((file, idx) => {
      const id = `file_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`
      const previewUrl = cacheUploadedFile(id, file)
      const ext = file.name.split(".").pop()?.toLowerCase() || ""
      const isFormatValid = ALLOWED_EXTENSIONS.includes(ext)
      const isSizeValid = file.size <= MAX_FILE_SIZE
      let status: "uploading" | "error" = "uploading"
      let errorMessage: string | undefined
      if (!isFormatValid) {
        status = "error"
        errorMessage = ext.match(/docx?|pptx?/)
          ? "Word and PowerPoint files are not supported yet"
          : "Unsupported format"
      } else if (!isSizeValid) {
        errorMessage = "Exceeds 50MB limit"
        status = "error"
      }
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        progress: 0,
        status,
        errorMessage,
        previewUrl,
      }
    })

    setUploadedFiles((prev) => [...prev, ...newItems])
    const validNewItems = newItems.filter((item) => item.status === "uploading")
    if (validNewItems.length === 0) return
    void runUpload(validNewItems).then(() => {
      const succeeded = validNewItems.length
      if (succeeded > 0) {
        showToast(`${succeeded} document${succeeded > 1 ? "s" : ""} uploaded`)
      }
    })
  }

  const handleRemoveFile = (fileId: string) => {
    const target = uploadedFiles.find((file) => file.id === fileId)
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId))
    if (target?.status === "success") {
      void deleteGuestDocument(fileId).catch(() => undefined)
    }
  }

  const handleRetryFile = (fileId: string) => {
    const target = uploadedFiles.find((file) => file.id === fileId)
    if (!target) return
    setUploadedFiles((prev) =>
      prev.map((file) =>
        file.id === fileId
          ? { ...file, status: "uploading", progress: 0, errorMessage: undefined }
          : file,
      ),
    )
    void runUpload([{ ...target, status: "uploading", progress: 0 }])
  }

  const handleContinueToConfig = () => {
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
                • {isAvailable ? "Open" : "Closed"}
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
