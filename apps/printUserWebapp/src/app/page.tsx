'use client';

import React, { useState } from 'react';
import { MobileHeader } from '../components/mobile-header';
import { HeroSection } from '../components/hero-section';
import { DocumentsUploadCard } from '../components/documents-upload-card';
import { PromiseSection } from '../components/promise-section';
import { FAQSection } from '../components/faq-section';
import { BrandFooter } from '../components/brand-footer';
import { FloatingOrderIndicator } from '../components/floating-order-indicator';
import { mockShop, faqList } from '../data/mock-shop';
import { UploadedFileItem } from '../types/upload';

export default function PrintUserUploadPage() {
  const [shop] = useState(mockShop);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isUploadingOverall, setIsUploadingOverall] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle native file selection
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: UploadedFileItem[] = Array.from(files).map((file, idx) => ({
      id: `file_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      progress: 0,
      status: 'uploading',
    }));

    setUploadedFiles((prev) => [...prev, ...newItems]);
    setIsUploadingOverall(true);

    // Simulate realistic upload progress for each new file
    newItems.forEach((item, index) => {
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 25) + 15;
        if (currentProgress >= 100) {
          clearInterval(interval);
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    progress: 100,
                    status: 'success',
                  }
                : f
            )
          );

          if (index === newItems.length - 1) {
            setIsUploadingOverall(false);
            showToast(`${newItems.length} document${newItems.length > 1 ? 's' : ''} uploaded successfully!`);
          }
        } else {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    progress: Math.min(currentProgress, 95),
                  }
                : f
            )
          );
        }
      }, 150 + index * 60);
    });
  };

  // Remove a single file
  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Retry an uploaded file
  const handleRetryFile = (fileId: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, status: 'uploading', progress: 10, errorMessage: undefined } : f
      )
    );

    setTimeout(() => {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'success', progress: 100 } : f
        )
      );
      showToast('File uploaded successfully!');
    }, 600);
  };

  // Navigate or proceed to Screen 02
  const handleContinueToConfig = () => {
    const validFiles = uploadedFiles.filter((f) => f.status === 'success');
    if (validFiles.length === 0) return;
    showToast(`Continuing to Screen 02 with ${validFiles.length} file(s)...`);
  };

  const isAvailable = shop.status === 'OPEN' || shop.status === 'BUSY';
  const hasUploadedFiles = uploadedFiles.some((f) => f.status === 'success');

  return (
    <div className="min-h-screen bg-[#edf2f7] flex justify-center selection:bg-macaw-blue selection:text-paper">
      {/* Mobile-first viewport container: max 430px, paper surface, flat borders */}
      <main
        className={`w-full max-w-[430px] min-h-screen bg-paper flex flex-col relative border-x border-graphite/15 ${
          hasUploadedFiles ? 'pb-20' : 'pb-0'
        }`}
      >
        {/* Sticky Notification Toast */}
        {notification && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-midnight text-paper text-caption font-bold rounded-xl border border-graphite/30 transition-all animate-fadeIn">
            {notification}
          </div>
        )}

        {/* 1. Header (Side arrow and share removed) */}
        <div className="bg-[#0283fd]">
          <MobileHeader
            onSearch={() => showToast('Search services coming soon')}
          />
        </div>

        {/* 2. Hero Section */}
        <HeroSection
          isAvailable={isAvailable}
          shopName={shop.name}
          stickerText="Print it. Pick it. Done."
        />

        {/* 3. Documents Upload Card */}
        <DocumentsUploadCard
          isAvailable={isAvailable}
          startingPrice={shop.startingPriceA4}
          uploadedFiles={uploadedFiles}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveFile}
          onRetryFile={handleRetryFile}
          isUploadingOverall={isUploadingOverall}
        />

        {/* 5. We Promise Section */}
        <PromiseSection />

        {/* 6. FAQ Section (unwanted bottom line removed) */}
        <FAQSection items={faqList} />

        {/* 7. Brand Promotional Footer (excessive white space and duplicate line removed) */}
        <BrandFooter />

        {/* 8. Persistent Floating Order Indicator */}
        <FloatingOrderIndicator
          files={uploadedFiles}
          onContinue={handleContinueToConfig}
        />
      </main>
    </div>
  );
}
