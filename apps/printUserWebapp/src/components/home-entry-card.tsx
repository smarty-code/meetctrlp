"use client"

import React from "react"
import { Button } from "@ctrlp/ui/button"
import { QrCode } from "lucide-react"
import { DocumentCollageIllustration } from "./illustrations/document-collage-illustration"

interface HomeEntryCardProps {
  onScanQr: () => void
}

export const HomeEntryCard: React.FC<HomeEntryCardProps> = ({ onScanQr }) => {
  return (
    <div className="mx-auto mt-4 w-full max-w-xl px-4 sm:mt-6 sm:px-6 md:mt-8 md:max-w-2xl lg:max-w-3xl">
      <div className="w-full rounded-xl border border-graphite/20 bg-paper p-5 sm:p-7 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 pr-1">
            <h2 className="font-heading text-heading-sm leading-snug tracking-heading-sm text-midnight sm:text-heading">
              Print at a shop
            </h2>
            <p className="mt-1 text-body font-medium text-charcoal sm:text-[16px]">
              Scan the QR on the shop counter to open that shop and upload your documents.
            </p>
          </div>
          <div className="shrink-0 origin-top-right scale-95 transform sm:scale-105 md:scale-110">
            <DocumentCollageIllustration />
          </div>
        </div>

        <div className="mt-5 sm:mt-6">
          <Button
            type="button"
            onClick={onScanQr}
            size="default"
            className="h-12 w-full rounded-xl text-[15px] font-bold sm:h-13 sm:text-[16px] md:h-14 md:text-[17px]"
          >
            <span className="flex items-center gap-2">
              <QrCode className="size-5 stroke-[2.5]" />
              <span>Scan QR code</span>
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
