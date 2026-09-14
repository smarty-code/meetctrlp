"use client"

import React from "react"
import { UploadedFileItem } from "../types/upload"
import { ChevronRight, FileText, FileImage } from "lucide-react"

interface FloatingOrderIndicatorProps {
  files: UploadedFileItem[]
  onContinue: () => void
}

export const FloatingOrderIndicator: React.FC<FloatingOrderIndicatorProps> = ({
  files,
  onContinue,
}) => {
  const successFiles = files.filter((f) => f.status === "success")
  if (successFiles.length === 0) return null

  return (
    <aside
      aria-label="Order summary"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 mx-auto w-full max-w-[420px] px-4 md:inset-x-auto md:right-8 md:bottom-8 md:mx-0 md:max-w-[360px] md:px-0"
    >
      {/* 12px radius, flat 3D pressable bottom border, no drop shadow */}
      <button
        type="button"
        onClick={onContinue}
        className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-xl border-x border-t border-b-[3px] border-macaw-blue/40 border-b-[#0284c7] bg-macaw-blue p-3.5 px-4 text-paper shadow-md transition-all select-none hover:bg-macaw-blue/90 active:translate-y-px sm:px-5 md:shadow-lg"
      >
        {/* Left order label & count */}
        <div className="flex flex-col justify-center text-left">
          <span className="font-sans text-[11px] font-bold tracking-caption text-paper/90 uppercase">
            PRINT ORDER
          </span>
          <span className="font-sans text-[15px] leading-tight font-black text-paper sm:text-[16px]">
            {successFiles.length} {successFiles.length === 1 ? "FILE" : "FILES"}
          </span>
        </div>

        {/* Center thumbnails stack */}
        <div className="flex items-center -space-x-2 overflow-hidden px-1 py-1">
          {successFiles.slice(0, 4).map((file) => {
            const isImage = file.type.startsWith("image/")
            return (
              <div
                key={file.id}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-macaw-blue bg-paper text-charcoal sm:size-8.5"
                title={file.name}
              >
                {isImage ? (
                  <FileImage className="size-4 text-macaw-blue" />
                ) : (
                  <FileText className="size-4 text-ecto-green" />
                )}
              </div>
            )
          })}
          {successFiles.length > 4 && (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-macaw-blue bg-paper text-[10px] font-black text-midnight">
              +{successFiles.length - 4}
            </div>
          )}
        </div>

        {/* Right Arrow / Continue action */}
        <div className="flex shrink-0 items-center gap-1.5 text-paper">
          <span className="xs:inline hidden text-caption font-bold">Next</span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-paper/20 sm:size-7.5">
            <ChevronRight className="size-4 stroke-[3]" />
          </div>
        </div>
      </button>
    </aside>
  )
}
