"use client"

import React, { useRef } from "react"
import { UploadedFileItem } from "../types/upload"
import { customizeConfig } from "../data/customize-repository"
import { DocumentCollageIllustration } from "./illustrations/document-collage-illustration"
import { Button } from "@ctrlp/ui/button"
import { Upload } from "lucide-react"
import { UploadProgressDrawer } from "./upload-progress-drawer"

interface DocumentsUploadCardProps {
  isAvailable?: boolean
  startingPrice?: number
  shopName?: string
  title?: string
  description?: string
  uploadedFiles: UploadedFileItem[]
  onFilesSelected: (files: FileList | null) => void
  onRemoveFile: (fileId: string) => void
  onRetryFile: (fileId: string) => void
  isUploadingOverall?: boolean
  /** Every file is uploaded and the page is about to move on to customize. */
  isUploadComplete?: boolean
  /** All bytes are in storage; the server is still checking the files and counting pages. */
  isCheckingUploads?: boolean
  /** Combined percentage for the files in the current upload round. */
  uploadProgress?: number
  uploadingCount?: number
}

export const DocumentsUploadCard: React.FC<DocumentsUploadCardProps> = ({
  isAvailable = true,
  startingPrice = 3,
  shopName,
  title,
  description,
  uploadedFiles,
  onFilesSelected,
  onRemoveFile,
  onRetryFile,
  isUploadingOverall = false,
  isUploadComplete = false,
  isCheckingUploads = false,
  uploadProgress = 0,
  uploadingCount = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const showDrawer = isUploadingOverall || isUploadComplete

  // Dynamic copy computed from state (no hardcoding)
  const resolvedTitle =
    title ??
    (!isAvailable
      ? "Printing is paused"
      : uploadedFiles.length > 0
        ? `${uploadedFiles.length} document${uploadedFiles.length === 1 ? "" : "s"} added`
        : shopName
          ? `Print at ${shopName}`
          : "Print documents")

  const resolvedDescription =
    description ??
    (!isAvailable
      ? "This shop is currently not accepting new print jobs. Please check back later."
      : uploadedFiles.length > 0
        ? "Add more documents or continue configuring your print options."
        : startingPrice
          ? `Upload your documents for instant A4 prints starting at ₹${startingPrice} per page.`
          : "Upload your documents for instant counter collection.")

  const handleButtonClick = () => {
    if (!isAvailable) return
    fileInputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files)
    if (e.target) e.target.value = ""
  }

  const handleCancelUpload = () => {
    // Remove all uploading files from the list to cancel the upload round.
    // This uses the existing onRemoveFile callback per file so the parent
    // state is the single source of truth and any server-side cleanup runs.
    uploadedFiles
      .filter((file) => file.status === "uploading")
      .forEach((file) => onRemoveFile(file.id))
  }

  return (
    <>
      <div className="mx-auto mt-4 w-full max-w-xl px-4 sm:mt-6 sm:px-6 md:mt-8 md:max-w-2xl lg:max-w-3xl">
        {/* Paper surface, rounded card, subtle border matching design */}
        <div className="w-full rounded-2xl border border-graphite/20 bg-paper p-5 sm:p-7 md:p-8">
          {/* Card Header & Collage Artwork — Simplified clean layout */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 pr-1">
              <h2 className="font-heading text-heading-sm leading-snug tracking-heading-sm text-midnight sm:text-heading">
                {resolvedTitle}
              </h2>
              <p className="mt-1 text-body font-medium text-charcoal sm:text-[16px]">
                {resolvedDescription}
              </p>
            </div>

            <div className="shrink-0 origin-top-right scale-95 transform sm:scale-105 md:scale-110">
              <DocumentCollageIllustration />
            </div>
          </div>

          {/* Hidden Native File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={customizeConfig.acceptedFileTypes}
            className="hidden"
            onChange={handleInputChange}
            disabled={!isAvailable}
          />

          {/* Primary CTA using design-system @ctrlp/ui Button */}
          <div className="mt-5 sm:mt-6">
            <Button
              type="button"
              onClick={handleButtonClick}
              disabled={!isAvailable}
              size="default"
              className="relative h-12 w-full overflow-hidden rounded-xl text-[15px] font-bold sm:h-13 sm:text-[16px] md:h-14 md:text-[17px]"
            >
              <span className="flex items-center gap-2">
                <Upload className="size-5 stroke-[2.5]" />
                <span>
                  {uploadedFiles.length > 0
                    ? "Upload More Documents"
                    : "Upload Document"}
                </span>
              </span>
            </Button>
          </div>


        </div>
      </div>

      {/* Upload progress bottom sheet — replaces the old inline file list */}
      <UploadProgressDrawer
        open={showDrawer}
        documentCount={uploadingCount}
        progress={uploadProgress}
        isComplete={isUploadComplete}
        isChecking={isCheckingUploads}
        onCancel={handleCancelUpload}
      />
    </>
  )
}
