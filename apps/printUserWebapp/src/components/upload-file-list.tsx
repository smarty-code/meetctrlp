"use client"

import React, { useState } from "react"
import { FileText, ImageIcon, RotateCw, X } from "lucide-react"
import { UploadedFileItem } from "../types/upload"

interface UploadFileListProps {
  files: UploadedFileItem[]
  /** Clear all is on its way to the server; the list is locked until it settles. */
  isClearing?: boolean
  onRemove: (fileId: string) => void
  onRetry: (fileId: string) => void
  onClearAll: () => void
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileMeta(file: UploadedFileItem) {
  if (file.status === "uploading") {
    return file.progress >= 100 ? "Checking…" : `Uploading… ${file.progress}%`
  }
  if (file.status === "error") return file.errorMessage ?? "Upload failed"
  const pages = file.pageCount ? `${file.pageCount} ${file.pageCount === 1 ? "page" : "pages"} · ` : ""
  return `${pages}${formatFileSize(file.size)}`
}

/**
 * The cart as the shopper sees it on the upload page: every document with its state, a way to
 * remove or retry each one, and Clear all. Rows follow the review list (bordered rows, no cards).
 */
export const UploadFileList: React.FC<UploadFileListProps> = ({
  files,
  isClearing = false,
  onRemove,
  onRetry,
  onClearAll,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false)

  if (files.length === 0) return null

  return (
    <section
      aria-labelledby="upload-file-list-heading"
      className="mt-5 overflow-hidden rounded-xl border border-graphite/15 bg-paper"
    >
      <div className="flex items-center justify-between gap-3 border-b border-graphite/10 px-4 py-2.5">
        <h3 id="upload-file-list-heading" className="text-body font-bold text-midnight">
          Your documents
          <span className="ml-1.5 text-caption font-bold text-ash">{files.length}</span>
        </h3>
        {!isConfirmingClear && (
          <button
            type="button"
            onClick={() => setIsConfirmingClear(true)}
            disabled={isClearing}
            className="cursor-pointer rounded-xl px-2 py-1 text-caption font-bold text-ash transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
          >
            {isClearing ? "Clearing…" : "Clear all"}
          </button>
        )}
      </div>

      {isConfirmingClear && (
        <div
          role="alertdialog"
          aria-labelledby="clear-all-question"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite/10 bg-destructive/5 px-4 py-2.5"
        >
          <p id="clear-all-question" className="text-caption font-bold text-midnight">
            Remove all {files.length} {files.length === 1 ? "document" : "documents"}?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConfirmingClear(false)}
              className="cursor-pointer rounded-xl border border-graphite/20 bg-paper px-3 py-1 text-caption font-bold text-midnight transition-colors hover:bg-graphite/5"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => {
                setIsConfirmingClear(false)
                onClearAll()
              }}
              className="cursor-pointer rounded-xl border border-destructive bg-paper px-3 py-1 text-caption font-bold text-destructive transition-colors hover:bg-destructive/10"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-graphite/10">
        {files.map((file) => {
          const isImage = file.type.startsWith("image/")
          const Icon = isImage ? ImageIcon : FileText
          return (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
              <div
                aria-hidden="true"
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${
                  file.status === "error"
                    ? "border-destructive/40 text-destructive"
                    : "border-graphite/15 bg-eel-light/40 text-charcoal"
                }`}
              >
                <Icon className="size-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-midnight" title={file.name}>
                  {file.name}
                </p>
                <p
                  className={`mt-0.5 truncate text-[12px] font-medium ${
                    file.status === "error" ? "text-destructive" : "text-ash"
                  }`}
                  aria-live={file.status === "uploading" ? "off" : "polite"}
                >
                  {fileMeta(file)}
                </p>
                {file.status === "uploading" && (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-xl bg-graphite/10" aria-hidden="true">
                    <div
                      className="h-full rounded-xl bg-ecto-green transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, file.progress))}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {file.status === "error" && file.file && (
                  <button
                    type="button"
                    onClick={() => onRetry(file.id)}
                    disabled={isClearing}
                    aria-label={`Retry uploading ${file.name}`}
                    title="Retry"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-xl border-2 border-macaw-blue bg-paper text-macaw-blue transition-colors hover:bg-macaw-blue/10 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <RotateCw className="size-4 stroke-[2.5]" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  disabled={isClearing}
                  aria-label={
                    file.status === "uploading" ? `Cancel uploading ${file.name}` : `Remove ${file.name}`
                  }
                  title={file.status === "uploading" ? "Cancel" : "Remove"}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-xl border border-graphite/20 bg-paper text-charcoal transition-colors hover:border-destructive hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-4 stroke-[2.5]" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
