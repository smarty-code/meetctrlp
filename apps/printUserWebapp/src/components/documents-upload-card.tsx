"use client"

import React, { useRef } from "react"
import { UploadedFileItem } from "../types/upload"
import { DocumentCollageIllustration } from "./illustrations/document-collage-illustration"
import { Button } from "@ctrlp/ui/button"
import {
  Upload,
  FileText,
  CheckCircle2,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react"

interface DocumentsUploadCardProps {
  isAvailable?: boolean
  startingPrice?: number
  uploadedFiles: UploadedFileItem[]
  onFilesSelected: (files: FileList | null) => void
  onRemoveFile: (fileId: string) => void
  onRetryFile: (fileId: string) => void
  isUploadingOverall?: boolean
}

export const DocumentsUploadCard: React.FC<DocumentsUploadCardProps> = ({
  isAvailable = true,
  startingPrice = 3,
  uploadedFiles,
  onFilesSelected,
  onRemoveFile,
  onRetryFile,
  isUploadingOverall = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleButtonClick = () => {
    if (!isAvailable || isUploadingOverall) return
    fileInputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files)
    if (e.target) e.target.value = ""
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-xl px-4 sm:mt-6 sm:px-6 md:mt-8 md:max-w-2xl lg:max-w-3xl">
      {/* Paper surface, rounded card, subtle border matching design */}
      <div className="w-full rounded-2xl border border-graphite/20 bg-paper p-5 shadow-xs sm:p-7 md:p-8">
        {/* Card Header & Collage Artwork */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 pr-1">
            <h2 className="font-heading text-heading-sm leading-snug tracking-heading-sm text-midnight sm:text-heading">
              Documents
            </h2>
            <p className="mt-1 text-body font-medium text-charcoal sm:text-[16px]">
              A4 B/W and Color prints
            </p>
            <p className="mt-0.5 text-body font-bold text-midnight sm:text-[16px]">
              Starts at ₹{startingPrice} per page
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
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.ppt,.pptx"
          className="hidden"
          onChange={handleInputChange}
          disabled={!isAvailable}
        />

        {/* Primary CTA using design-system @ctrlp/ui Button */}
        <div className="mt-5 sm:mt-6">
          <Button
            type="button"
            onClick={handleButtonClick}
            disabled={!isAvailable || isUploadingOverall}
            size="default"
            className="h-12 w-full rounded-xl text-[15px] font-bold sm:h-13 sm:text-[16px] md:h-14 md:text-[17px]"
          >
            {isUploadingOverall ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-5 animate-spin" />
                <span>Uploading documents...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="size-5 stroke-[2.5]" />
                <span>
                  {uploadedFiles.length > 0
                    ? "Upload More Documents"
                    : "Upload Document"}
                </span>
              </span>
            )}
          </Button>
        </div>

        {/* Uploaded File List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-5 flex flex-col gap-3 border-t border-graphite/15 pt-5 sm:mt-6 sm:pt-6">
            <div className="flex items-center justify-between px-1 text-caption font-bold tracking-caption text-ash uppercase">
              <span>Selected Files ({uploadedFiles.length})</span>
              <span>Status</span>
            </div>

            <div className="flex max-h-64 flex-col gap-2.5 overflow-y-auto pr-0.5">
              {uploadedFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-graphite/20 bg-paper p-3 text-body sm:p-3.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-ecto-green/40 bg-eel-light text-midnight sm:size-10">
                      <FileText className="size-4 stroke-[2.2] sm:size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-midnight sm:text-[15px]">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-caption font-medium text-ash">
                        <span>{formatFileSize(item.size)}</span>
                        {item.status === "uploading" && (
                          <span className="font-bold text-macaw-blue">
                            {item.progress}%
                          </span>
                        )}
                        {item.status === "error" && (
                          <span className="max-w-[140px] truncate font-bold text-destructive">
                            {item.errorMessage || "Upload failed"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Status Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === "uploading" && (
                      <Loader2 className="size-4 animate-spin text-macaw-blue" />
                    )}
                    {item.status === "success" && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-ecto-green/50 bg-eel-light px-2.5 py-1 text-caption font-bold text-midnight">
                        <CheckCircle2 className="size-3.5 text-ecto-green" />
                        Uploaded
                      </span>
                    )}
                    {item.status === "error" && (
                      <button
                        type="button"
                        onClick={() => onRetryFile(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-caption font-bold text-destructive active:translate-y-px"
                      >
                        <RefreshCw className="size-3" />
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveFile(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="ml-0.5 flex size-8 items-center justify-center rounded-lg text-ash transition-colors hover:bg-graphite/10 hover:text-midnight"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
