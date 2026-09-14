'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '../components/mobile-header';
import { HeroSection } from '../components/hero-section';
import { DocumentsUploadCard } from '../components/documents-upload-card';
import { PromiseSection } from '../components/promise-section';
import { FAQSection } from '../components/faq-section';
import { BrandFooter } from '../components/brand-footer';
import { FloatingOrderIndicator } from '../components/floating-order-indicator';
import { cacheUploadedFile, getCachedFileUrl } from '../lib/file-store';
import { mockShop, faqList } from '../data/mock-shop';
import { UploadedFileItem } from '../types/upload';

export default function Home() {
  const router = useRouter();
  const [shop] = useState(mockShop);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isUploadingOverall, setIsUploadingOverall] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Quick toast helper
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle files selected from DocumentsUploadCard
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: UploadedFileItem[] = Array.from(files).map((file, idx) => {
      const id = `file_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      const previewUrl = cacheUploadedFile(id, file);
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        progress: 0,
        status: 'uploading',
        previewUrl,
      };
    });

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
    validFiles.forEach((f) => {
      if (f.file) {
        cacheUploadedFile(f.id, f.file);
      }
    });
    window.sessionStorage.setItem(
      'ctrlp-uploaded-files',
      JSON.stringify(
        validFiles.map(({ id, name, size, type }) => ({
          id,
          name,
          size,
          type,
          previewUrl: getCachedFileUrl(id) || undefined,
        }))
      )
    );
    router.push('/customize');
  };

  const isAvailable = shop.status === 'OPEN' || shop.status === 'BUSY';
  const hasUploadedFiles = uploadedFiles.some((f) => f.status === 'success');

  return (
    <div className="min-h-screen bg-paper flex flex-col selection:bg-macaw-blue selection:text-paper">
      {/* Root fluid responsive shell - supports mobile up to 1200px desktop */}
      <main
        className={`w-full min-h-screen bg-paper flex flex-col relative ${
          hasUploadedFiles ? 'pb-24 md:pb-12' : 'pb-0'
        }`}
      >
        {/* Sticky Notification Toast */}
        {notification && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-midnight text-paper text-caption font-bold rounded-xl border border-graphite/30 transition-all animate-fadeIn shadow-lg">
            {notification}
          </div>
        )}

        {/* 1. Universal Responsive Header */}
        <MobileHeader
          onSearch={() => showToast('Search services coming soon')}
        />

        {/* 2. Responsive Hero Section */}
        <HeroSection
          isAvailable={isAvailable}
          shopName={shop.name}
          stickerText="Print it. Pick it. Done."
        />

        {/* 3. Responsive Documents Upload Card */}
        <DocumentsUploadCard
          isAvailable={isAvailable}
          startingPrice={shop.startingPriceA4}
          uploadedFiles={uploadedFiles}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveFile}
          onRetryFile={handleRetryFile}
          isUploadingOverall={isUploadingOverall}
        />

        {/* 4. Responsive We Promise Section (1 col mobile -> 3 cols tablet/desktop) */}
        <PromiseSection />

        {/* 5. Responsive FAQ Section */}
        <FAQSection items={faqList} />

        {/* 6. Responsive Brand Promotional Footer */}
        <BrandFooter />

        {/* 7. Responsive Floating Order Indicator (mobile bottom bar, desktop bottom-right widget) */}
        <FloatingOrderIndicator
          files={uploadedFiles}
          onContinue={handleContinueToConfig}
        />
      </main>
    </div>
  );
}
