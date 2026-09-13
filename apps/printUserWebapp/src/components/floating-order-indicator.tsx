'use client';

import React from 'react';
import { UploadedFileItem } from '../types/upload';
import { ChevronRight, FileText, FileImage } from 'lucide-react';

interface FloatingOrderIndicatorProps {
  files: UploadedFileItem[];
  onContinue: () => void;
}

export const FloatingOrderIndicator: React.FC<FloatingOrderIndicatorProps> = ({
  files,
  onContinue,
}) => {
  const successFiles = files.filter((f) => f.status === 'success');
  if (successFiles.length === 0) return null;

  return (
    <aside
      aria-label="Order summary"
      className="fixed bottom-5 inset-x-0 z-50 px-4 max-w-[420px] mx-auto pointer-events-none"
    >
      {/* 12px radius, flat 3D pressable bottom border, no drop shadow */}
      <button
        type="button"
        onClick={onContinue}
        className="w-full pointer-events-auto bg-macaw-blue hover:bg-macaw-blue/90 active:translate-y-px transition-all text-paper rounded-xl p-3 px-4 border-b-[3px] border-b-[#0284c7] border-t border-x border-macaw-blue/40 flex items-center justify-between gap-3 select-none"
      >
        {/* Left order label & count */}
        <div className="text-left flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-caption text-paper/90 font-sans">
            PRINT ORDER
          </span>
          <span className="text-[15px] font-black text-paper leading-tight font-sans">
            {successFiles.length} {successFiles.length === 1 ? 'FILE' : 'FILES'}
          </span>
        </div>

        {/* Center thumbnails stack */}
        <div className="flex items-center -space-x-2 overflow-hidden py-1 px-1">
          {successFiles.slice(0, 4).map((file) => {
            const isImage = file.type.startsWith('image/');
            return (
              <div
                key={file.id}
                className="size-8 rounded-lg bg-paper border-2 border-macaw-blue flex items-center justify-center text-charcoal shrink-0"
                title={file.name}
              >
                {isImage ? (
                  <FileImage className="size-4 text-macaw-blue" />
                ) : (
                  <FileText className="size-4 text-ecto-green" />
                )}
              </div>
            );
          })}
          {successFiles.length > 4 && (
            <div className="size-8 rounded-lg bg-paper border-2 border-macaw-blue flex items-center justify-center text-[10px] font-black text-midnight shrink-0">
              +{successFiles.length - 4}
            </div>
          )}
        </div>

        {/* Right Arrow / Continue action */}
        <div className="flex items-center gap-1.5 text-paper shrink-0">
          <span className="text-caption font-bold hidden xs:inline">Next</span>
          <div className="size-7 rounded-lg bg-paper/20 flex items-center justify-center">
            <ChevronRight className="size-4 stroke-[3]" />
          </div>
        </div>
      </button>
    </aside>
  );
};
