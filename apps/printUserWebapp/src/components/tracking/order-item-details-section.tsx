"use client";

import React, { useEffect, useState } from "react";
import { Check, CheckCircle2, FileText, Image as ImageIcon } from "lucide-react";
import { CompactDocumentItem, OrderTrackingData } from "../../types/tracking";
import { ORDER_STATUS_PRESENTATION } from "../../data/tracking-constants";
import { formatCurrency } from "../../lib/currency";
import { restoreCachedFile } from "../../lib/file-store";
import { PdfCanvasPreview } from "../customize/pdf-canvas-preview";

interface OrderItemDetailsSectionProps {
  order: OrderTrackingData;
}

/**
 * Compact mini document preview thumbnail (32x36px)
 */
function DocumentMiniPreview({ item }: { item: CompactDocumentItem }) {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    item.previewUrl,
  );
  const [fileObj, setFileObj] = useState<File | undefined>(undefined);
  const [imageError, setImageError] = useState(false);

  const isImage =
    item.type?.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|svg)$/i.test(item.name);
  const isPdf =
    item.type === "application/pdf" || /\.pdf$/i.test(item.name);

  useEffect(() => {
    if (resolvedUrl) return;
    let cancelled = false;
    void restoreCachedFile(item.id).then((res) => {
      if (!cancelled && res) {
        setResolvedUrl(res.url);
        setFileObj(res.file);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, resolvedUrl]);

  return (
    <div
      aria-hidden="true"
      className="relative flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-graphite/20 bg-eel-light/60 text-charcoal shadow-2xs"
    >
      {isImage && resolvedUrl && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : isPdf && (fileObj || resolvedUrl) ? (
        <div className="pointer-events-none relative size-full overflow-hidden flex items-center justify-center scale-90">
          <PdfCanvasPreview
            file={fileObj}
            previewUrl={resolvedUrl}
            pageNumber={1}
          />
        </div>
      ) : isImage ? (
        <ImageIcon className="size-3.5 text-ash" />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <FileText className="size-3.5 text-ash" />
          <span className="text-[7px] font-bold uppercase text-ash leading-none mt-0.5">
            PDF
          </span>
        </div>
      )}
    </div>
  );
}

export function OrderItemDetailsSection({
  order,
}: OrderItemDetailsSectionProps) {
  const { documentSummary } = order;
  const presentation = ORDER_STATUS_PRESENTATION[order.status];

  // Price calculation helper per document item
  const calculateItemPrice = (
    copies: number,
    pages: number,
    colorMode: "bw" | "color",
  ) => {
    const ratePerPage = colorMode === "color" ? 10 : 3;
    return copies * pages * ratePerPage;
  };

  return (
    <section aria-labelledby="item-details-heading" className="w-full">
      {/* 1. Gray Section Header Strip */}
      <div className="bg-graphite/5 px-4 py-2 sm:px-6">
        <h2
          id="item-details-heading"
          className="text-[11px] font-bold tracking-wider text-ash uppercase"
        >
          Item Details
        </h2>
      </div>

      {/* 2. Item Details Content Surface */}
      <div className="bg-paper px-4 py-3.5 sm:px-6 space-y-3">
        {/* Top Summary Row: Title + Total items/copies + Status Mark */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-body font-bold text-midnight leading-tight">
              Print Documents
            </h3>
            <p className="text-[12px] font-medium text-ash">
              {documentSummary.totalDocuments}{" "}
              {documentSummary.totalDocuments === 1 ? "item" : "items"}
              {" • "}
              {documentSummary.totalCopies}{" "}
              {documentSummary.totalCopies === 1 ? "copy" : "copies"}
            </p>
          </div>

          {/* Status Badge with Checkmark */}
          <div className="flex items-center gap-1 text-[12px] font-bold text-ecto-green">
            <CheckCircle2 className="size-4 stroke-[2.5]" />
            <span>{presentation.label}</span>
          </div>
        </div>

        {/* Dotted separator line */}
        <div className="border-t-2 border-dotted border-graphite/15" />

        {/* Itemized Document List */}
        <div className="space-y-3 pt-1">
          {documentSummary.items.map((item) => {
            const itemPrice =
              typeof item.linePrice === "number"
                ? item.linePrice
                : calculateItemPrice(
                    item.copies,
                    item.pages,
                    item.colorMode,
                  );
            const formattedItemPrice = formatCurrency(itemPrice, {
              currency: order.currency,
            });

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-caption"
              >
                {/* Left: Green Checkmark + Mini Preview Thumbnail + Copies x File Name + Specs */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <Check className="size-3.5 shrink-0 stroke-[3] text-ecto-green" />

                  {/* Compact Document Thumbnail Preview */}
                  <DocumentMiniPreview item={item} />

                  <div className="min-w-0">
                    <p
                      title={item.name}
                      className="truncate font-bold text-midnight leading-snug"
                    >
                      {item.copies} x {item.name}
                    </p>
                    <p className="text-[11px] font-medium text-ash leading-tight">
                      {item.pages} {item.pages === 1 ? "page" : "pages"}
                      {" • "}
                      {item.colorMode === "color" ? "Color" : "B&W"}
                      {" • "}
                      {item.paperSize}
                    </p>
                  </div>
                </div>

                {/* Right: Item Line Price */}
                <div className="shrink-0 text-right font-medium text-midnight">
                  <span>{formattedItemPrice}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
