'use client';

import React, { useRef } from 'react';
import { UploadedFileItem } from '../types/upload';
import { DocumentCollageIllustration } from './illustrations/document-collage-illustration';
import { Button } from '@ctrlp/ui/button';
import { Upload, FileText, CheckCircle2, X, RefreshCw, Loader2 } from 'lucide-react';

interface DocumentsUploadCardProps {
  isAvailable?: boolean;
  startingPrice?: number;
  uploadedFiles: UploadedFileItem[];
  onFilesSelected: (files: FileList | null) => void;
  onRemoveFile: (fileId: string) => void;
  onRetryFile: (fileId: string) => void;
  isUploadingOverall?: boolean;
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleButtonClick = () => {
    if (!isAvailable || isUploadingOverall) return;
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(e.target.files);
    if (e.target) e.target.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full px-4 mt-6">
      {/* 12px radius, flat border, paper surface */}
      <div className="w-full bg-paper rounded-xl p-5 border-2 border-graphite/15">
        {/* Card Header & Collage Artwork */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 pr-1">
            <h2 className="font-heading text-heading-sm text-midnight tracking-heading-sm leading-snug">
              Documents
            </h2>
            <p className="mt-1 text-body font-medium text-charcoal">
              A4 B/W and Color prints
            </p>
            <p className="text-body font-bold text-midnight">
              Starts at ₹{startingPrice} per page
            </p>
          </div>

          <DocumentCollageIllustration />
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
        <div className="mt-4">
          <Button
            type="button"
            onClick={handleButtonClick}
            disabled={!isAvailable || isUploadingOverall}
            size="default"
            className="w-full h-12 rounded-xl text-[15px] font-bold"
          >
            {isUploadingOverall ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Uploading documents...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="size-4 stroke-[2.5]" />
                <span>{uploadedFiles.length > 0 ? 'Upload More Documents' : 'Upload Document'}</span>
              </span>
            )}
          </Button>
        </div>

        {/* Uploaded File List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4 pt-4 border-t border-graphite/15 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-caption font-bold text-ash uppercase tracking-caption px-1">
              <span>Selected Files ({uploadedFiles.length})</span>
              <span>Status</span>
            </div>

            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-0.5">
              {uploadedFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-paper border border-graphite/20 text-body"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="size-8 rounded-lg bg-eel-light text-midnight flex items-center justify-center shrink-0 border border-ecto-green/40">
                      <FileText className="size-4 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-midnight text-[14px] truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-caption text-ash font-medium">
                        <span>{formatFileSize(item.size)}</span>
                        {item.status === 'uploading' && (
                          <span className="text-macaw-blue font-bold">{item.progress}%</span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-destructive font-bold truncate max-w-[120px]">
                            {item.errorMessage || 'Upload failed'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Status Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === 'uploading' && (
                      <Loader2 className="size-4 text-macaw-blue animate-spin" />
                    )}
                    {item.status === 'success' && (
                      <span className="inline-flex items-center gap-1 text-caption font-bold text-midnight bg-eel-light border border-ecto-green/50 px-2 py-0.5 rounded-lg">
                        <CheckCircle2 className="size-3.5 text-ecto-green" />
                        Uploaded
                      </span>
                    )}
                    {item.status === 'error' && (
                      <button
                        type="button"
                        onClick={() => onRetryFile(item.id)}
                        className="inline-flex items-center gap-1 text-caption font-bold text-destructive bg-destructive/10 border border-destructive/30 px-2 py-0.5 rounded-lg active:translate-y-px"
                      >
                        <RefreshCw className="size-3" />
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveFile(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="size-7 flex items-center justify-center rounded-lg text-ash hover:text-midnight hover:bg-graphite/10 transition-colors ml-0.5"
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
  );
};
