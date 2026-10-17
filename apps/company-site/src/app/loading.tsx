import React from "react"

/**
 * On-brand loading skeleton fallback
 * Governed by PRD Section 9.8
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-line border-t-lime animate-spin" />
        <span className="text-xs uppercase tracking-widest text-ink-faint font-medium">
          Loading MeetCtrlP…
        </span>
      </div>
    </div>
  )
}
