"use client";

import React, { useEffect } from "react";
import {
  Clock,
  FileText,
  Files,
  MapPin,
  PackageCheck,
  Palette,
  Printer,
  Store,
  X,
} from "lucide-react";
import { ShopContext } from "../types/upload";

interface ShopInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shop: ShopContext;
}

export function ShopInfoDrawer({ isOpen, onClose, shop }: ShopInfoDrawerProps) {
  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-info-title"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-midnight/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer / Modal content surface */}
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl border-t-2 border-x-2 border-graphite/20 bg-paper p-5 sm:rounded-2xl sm:border-2 sm:p-6 max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-graphite/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl border border-lingot-lime bg-eel-light/40 text-midnight">
              <Store className="size-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-wider text-ash uppercase">
                Shop Information
              </span>
              <h2
                id="shop-info-title"
                className="font-heading text-heading-sm font-bold text-midnight leading-tight"
              >
                {shop.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close shop information"
            className="flex size-9 cursor-pointer items-center justify-center rounded-xl border-2 border-graphite/20 bg-paper text-charcoal transition-colors hover:border-graphite/40"
          >
            <X className="size-4 stroke-[2.5]" />
          </button>
        </div>

        <div className="space-y-4 pt-4">
          {/* Card 1: Shop Location & Opening Time */}
          <div className="rounded-xl border-2 border-graphite/15 bg-paper p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4.5 shrink-0 text-ash" />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold tracking-wider text-ash uppercase">
                  Shop Location
                </span>
                <p className="mt-0.5 text-body font-medium leading-snug text-midnight">
                  {shop.address}
                </p>
              </div>
            </div>

            {/* Shop Opening Time */}
            {shop.openTime && shop.closeTime && (
              <div className="flex items-center gap-2 border-t border-graphite/10 pt-3 text-caption text-charcoal">
                <Clock className="size-4 shrink-0 text-ash" />
                <span>
                  Opening Hours:{" "}
                  <strong className="font-bold text-midnight">
                    {shop.openTime} – {shop.closeTime}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Supported Printing Options & Instant Counter Collection */}
          <div className="rounded-xl border-2 border-graphite/15 bg-paper p-4 space-y-3.5">
            <div className="flex items-start gap-2.5">
              <Printer className="mt-0.5 size-4.5 shrink-0 text-ash" />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold tracking-wider text-ash uppercase">
                  Supported Printing Options
                </span>

                <div className="mt-2.5 grid grid-cols-2 gap-2 text-caption">
                  <div className="flex items-center gap-2 rounded-lg border border-graphite/10 bg-graphite/5 px-3 py-2">
                    <FileText className="size-4 shrink-0 text-ash" />
                    <span className="font-bold text-midnight">A4 Paper Size</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-graphite/10 bg-graphite/5 px-3 py-2">
                    <Palette className="size-4 shrink-0 text-ash" />
                    <span className="font-bold text-midnight">B&W and Color</span>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2 text-[12px] text-charcoal">
                  <Files className="size-3.5 shrink-0 text-ash" />
                  <span>
                    <strong className="font-bold text-midnight">Formats: </strong>
                    PDF, Word (.docx), PowerPoint (.pptx), Images
                  </span>
                </div>
              </div>
            </div>

            {/* Instant Counter Collection */}
            <div className="flex items-start gap-2.5 border-t border-graphite/10 pt-3">
              <PackageCheck className="mt-0.5 size-4.5 shrink-0 text-ash" />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold tracking-wider text-ash uppercase">
                  Instant Counter Collection
                </span>
                <p className="mt-0.5 text-caption font-medium leading-relaxed text-charcoal">
                  Submit your print order from your phone, and collect your prints directly at the counter.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Dismiss CTA */}
        <div className="mt-5 border-t border-graphite/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer rounded-xl bg-ecto-green py-3 text-center text-body font-bold text-paper transition-opacity hover:opacity-95"
          >
            Back to Document Upload
          </button>
        </div>
      </div>
    </div>
  );
}
