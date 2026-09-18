"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "../components/mobile-header"
import { HeroSection } from "../components/hero-section"
import { DocumentsUploadCard } from "../components/documents-upload-card"
import { PromiseSection } from "../components/promise-section"
import { FAQSection } from "../components/faq-section"
import { BrandFooter } from "../components/brand-footer"
import { FloatingOrderIndicator } from "../components/floating-order-indicator"
import { cacheUploadedFile, getCachedFileUrl } from "../lib/file-store"
import { Info } from "lucide-react"
import { ShopInfoDrawer } from "../components/shop-info-drawer"
import { mockShop, faqList } from "../data/mock-shop"
import { UploadedFileItem } from "../types/upload"

export default function Home() {
  const router = useRouter()
  const [shop] = useState(mockShop)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([])
  const [isUploadingOverall, setIsUploadingOverall] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [isShopInfoOpen, setIsShopInfoOpen] = useState(false)

  // Quick toast helper
  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  // Handle files selected from DocumentsUploadCard
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const ALLOWED_EXTENSIONS = [
      "pdf",
      "jpg",
      "jpeg",
      "png",
      "doc",
      "docx",
      "ppt",
      "pptx",
    ]
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB limit

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
        errorMessage = "Unsupported format"
      } else if (!isSizeValid) {
        status = "error"
        errorMessage = "Exceeds 50MB limit"
      }

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        progress: status === "error" ? 0 : 0,
        status,
        errorMessage,
        previewUrl,
      }
    })

    setUploadedFiles((prev) => [...prev, ...newItems])

    const validNewItems = newItems.filter((item) => item.status === "uploading")
    if (validNewItems.length === 0) return

    setIsUploadingOverall(true)

    // Simulate realistic upload progress for valid new files
    validNewItems.forEach((item, index) => {
      let currentProgress = 0
      const interval = setInterval(
        () => {
          currentProgress += Math.floor(Math.random() * 25) + 15
          if (currentProgress >= 100) {
            clearInterval(interval)
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? {
                      ...f,
                      progress: 100,
                      status: "success",
                    }
                  : f
              )
            )

            if (index === newItems.length - 1) {
              setIsUploadingOverall(false)
              showToast(
                `${newItems.length} document${newItems.length > 1 ? "s" : ""} uploaded successfully!`
              )
            }
          } else {
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? {
                      ...f,
                      progress: Math.min(currentProgress, 95),
                    }
                  : f
              )
            )
          }
        },
        150 + index * 60
      )
    })
  }

  // Remove a single file
  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  // Retry an uploaded file
  const handleRetryFile = (fileId: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: "uploading", progress: 10, errorMessage: undefined }
          : f
      )
    )

    setTimeout(() => {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: "success", progress: 100 } : f
        )
      )
      showToast("File uploaded successfully!")
    }, 600)
  }

  // Navigate or proceed to Screen 02
  const handleContinueToConfig = () => {
    const validFiles = uploadedFiles.filter((f) => f.status === "success")
    if (validFiles.length === 0) return
    validFiles.forEach((f) => {
      if (f.file) {
        cacheUploadedFile(f.id, f.file)
      }
    })
    window.sessionStorage.setItem(
      "ctrlp-uploaded-files",
      JSON.stringify(
        validFiles.map(({ id, name, size, type }) => ({
          id,
          name,
          size,
          type,
          previewUrl: getCachedFileUrl(id) || undefined,
        }))
      )
    )
    router.push("/customize")
  }

  const isAvailable = shop.status === "OPEN" || shop.status === "BUSY"
  const hasUploadedFiles = uploadedFiles.some((f) => f.status === "success")

  return (
    <div className="flex min-h-screen flex-col bg-paper selection:bg-macaw-blue selection:text-paper">
      {/* Root fluid responsive shell - supports mobile up to 1200px desktop */}
      <main
        className={`relative flex min-h-screen w-full flex-col bg-paper ${
          hasUploadedFiles ? "pb-24 md:pb-12" : "pb-0"
        }`}
      >
        {/* Sticky Notification Toast */}
        {notification && (
          <div className="animate-fadeIn fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-graphite/30 bg-midnight px-4 py-2 text-caption font-bold text-paper shadow-lg transition-all">
            {notification}
          </div>
        )}

        {/* 1. Universal Responsive Header */}
        <MobileHeader
          onSearch={() => showToast("Search services coming soon")}
        />

        {/* 2. Responsive Hero Section */}
        <HeroSection
          isAvailable={isAvailable}
          shopName={shop.name}
          stickerText="Print it. Pick it. Done."
        />

        {/* 2.5 Shop Context Bar with "Shop Info" trigger leading to Screen 06 secondary sheet */}
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

        {/* 3. Responsive Documents Upload Card */}
        <DocumentsUploadCard
          isAvailable={isAvailable}
          startingPrice={shop.startingPriceA4}
          uploadedFiles={uploadedFiles}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveFile}
          onRetryFile={handleRetryFile}
          isUploadingOverall={isUploadingOverall}
        />

        {/* 4. Responsive We Promise Section (1 col mobile -> 3 cols tablet/desktop) */}
        <PromiseSection />

        {/* 5. Responsive FAQ Section */}
        <FAQSection items={faqList} />

        {/* 6. Responsive Brand Promotional Footer */}
        <BrandFooter />

        {/* 7. Responsive Floating Order Indicator (mobile bottom bar, desktop bottom-right widget) */}
        <FloatingOrderIndicator
          files={uploadedFiles}
          onContinue={handleContinueToConfig}
        />

        {/* 8. Optional Nested Screen 06: Shop Information Drawer */}
        <ShopInfoDrawer
          isOpen={isShopInfoOpen}
          onClose={() => setIsShopInfoOpen(false)}
          shop={shop}
        />
      </main>
    </div>
  )
}
