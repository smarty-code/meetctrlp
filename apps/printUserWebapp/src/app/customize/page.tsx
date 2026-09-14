'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ctrlp/ui/button';
import { FileText, Upload } from 'lucide-react';
import { ApplyToAll } from '../../components/customize/apply-to-all';
import { ColorSelector } from '../../components/customize/color-selector';
import { CustomizeHeader } from '../../components/customize/customize-header';
import { DocumentConfigurationCard } from '../../components/customize/document-configuration-card';
import { DocumentSelector } from '../../components/customize/document-selector';
import { OrderSummaryBar } from '../../components/customize/order-summary-bar';
import { OrientationSelector } from '../../components/customize/orientation-selector';
import { PaperSizeSelector } from '../../components/customize/paper-size-selector';
import { restoreCachedFile } from '../../lib/file-store';
import { customizeConfig, customizeCopy, mockConfigurationDocuments } from '../../data/customize-repository';
import { copyConfigurationToDocument, mapStoredFilesToDocuments, mapFileListToDocuments } from '../../data/customize-mapper';
import { ConfigurableDocument, PrintConfiguration } from '../../types/upload';

function readInitialDocuments(): ConfigurableDocument[] {
  if (typeof window === 'undefined') return mockConfigurationDocuments;
  try {
    const stored = window.sessionStorage.getItem('ctrlp-uploaded-files');
    return stored ? mapStoredFilesToDocuments(JSON.parse(stored), 'uploaded') : mockConfigurationDocuments;
  } catch {
    return mockConfigurationDocuments;
  }
}

function selectedPageCount(document: ConfigurableDocument): number {
  return document.pageCount;
}

export default function CustomizePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<ConfigurableDocument[]>(readInitialDocuments);
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? '');
  const [previewPage, setPreviewPage] = useState(1);
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const selectedDocument = documents.find((document) => document.id === selectedId) ?? documents[0];

  // Restore cached files and object URLs from IndexedDB if navigating directly or after reload
  useEffect(() => {
    let isMounted = true;
    (async () => {
      let hasUpdates = false;
      const restored = await Promise.all(
        documents.map(async (doc) => {
          if ((!doc.previewUrl || !doc.file) && doc.id) {
            const cached = await restoreCachedFile(doc.id);
            if (cached) {
              hasUpdates = true;
              return { ...doc, file: cached.file, previewUrl: cached.url };
            }
          }
          return doc;
        })
      );
      if (isMounted && hasUpdates) {
        setDocuments(restored);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [documents.length]);

  const handlePageCountDetected = (docId: string, count: number) => {
    setDocuments((current) =>
      current.map((doc) =>
        doc.id === docId && doc.pageCount !== count ? { ...doc, pageCount: count } : doc
      )
    );
  };

  const updateDocument = (id: string, configuration: Partial<PrintConfiguration>) => {
    setIsUpdatingPrice(true);
    setDocuments((current) => current.map((document) => document.id === id ? { ...document, configuration: { ...document.configuration, ...configuration } } : document));
    window.setTimeout(() => setIsUpdatingPrice(false), customizeConfig.priceUpdateDuration);
  };

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newDocs = mapFileListToDocuments(fileList, `added-${Date.now()}`);
    if (newDocs.length === 0) return;

    setDocuments((current) => {
      const next = [...current, ...newDocs];
      try {
        window.sessionStorage.setItem(
          'ctrlp-uploaded-files',
          JSON.stringify(
            next.map(({ id, name, size, type, previewUrl }) => ({
              id,
              name,
              size,
              type,
              previewUrl,
            }))
          )
        );
      } catch {}
      return next;
    });

    // Auto-select the first newly added document so it immediately appears in the queue
    setSelectedId(newDocs[0].id);
    setPreviewPage(1);
    setNotification(`Added ${newDocs.length} document${newDocs.length > 1 ? 's' : ''}`);
    window.setTimeout(() => setNotification(null), customizeConfig.notificationDuration);
  };

  const removeSelected = () => {
    if (!selectedDocument) return;
    const remaining = documents.filter((document) => document.id !== selectedDocument.id);
    setDocuments(remaining);
    setSelectedId(remaining[0]?.id ?? '');
    setPreviewPage(1);
    try {
      window.sessionStorage.setItem(
        'ctrlp-uploaded-files',
        JSON.stringify(
          remaining.map(({ id, name, size, type, previewUrl }) => ({
            id,
            name,
            size,
            type,
            previewUrl,
          }))
        )
      );
    } catch {}
  };

  const moveDocument = (offset: number) => {
    if (documents.length < 1) return;
    const currentIndex = documents.findIndex((document) => document.id === selectedId);
    setSelectedId(documents[(currentIndex + offset + documents.length) % documents.length].id);
    setPreviewPage(1);
  };

  const applyToAll = () => {
    if (!selectedDocument) return;
    setDocuments((current) => current.map((document) => ({ ...document, configuration: copyConfigurationToDocument(selectedDocument.configuration, document) })));
    setNotification(customizeCopy.settingsCopied);
    window.setTimeout(() => setNotification(null), customizeConfig.notificationDuration);
  };

  const totalPages = useMemo(() => documents.reduce((total, document) => total + selectedPageCount(document), 0), [documents]);
  const totalPrice = useMemo(() => documents.reduce((total, document) => total + selectedPageCount(document) * document.configuration.copies * customizeConfig.pricePerPage[document.configuration.colorMode], 0), [documents]);
  const canContinue = documents.length > 0 && documents.every((document) => document.status === 'ready') && !isUpdatingPrice;

  return <main className="min-h-screen overflow-x-hidden bg-paper pb-[calc(11rem+env(safe-area-inset-bottom))] text-charcoal sm:pb-36"><div className="mx-auto w-full max-w-300 min-w-0 px-4 sm:px-6">
    <CustomizeHeader onBack={() => router.push('/')} onAddFiles={handleAddFiles} fileInputRef={fileInputRef} />
    {notification && <div className="mt-4 border-2 border-ecto-green bg-eel-light px-4 py-3 text-body font-bold text-midnight">{notification}</div>}
    {selectedDocument ? <>
      <DocumentSelector
        documents={documents}
        selectedId={selectedDocument.id}
        previewPage={previewPage}
        onSelect={(id) => { setSelectedId(id); setPreviewPage(1); }}
        onMove={moveDocument}
        onPreviewPage={setPreviewPage}
        onRemove={removeSelected}
        onPageCountDetected={handlePageCountDetected}
      />
      <section className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-2" aria-label={customizeCopy.preview}>
        <DocumentConfigurationCard
          document={selectedDocument}
          fileIndex={documents.findIndex((d) => d.id === selectedDocument.id) + 1}
          onRemove={removeSelected}
          onCopiesChange={(copies) => updateDocument(selectedDocument.id, { copies: Math.min(customizeConfig.maxCopies, copies) })}
        />
        <ColorSelector value={selectedDocument.configuration.colorMode} onChange={(colorMode) => updateDocument(selectedDocument.id, { colorMode })} />
        <OrientationSelector value={selectedDocument.configuration.orientation} onChange={(orientation) => updateDocument(selectedDocument.id, { orientation })} />
        <PaperSizeSelector />
        <ApplyToAll onApply={applyToAll} />
      </section>
    </> : <EmptyState onAddFiles={handleAddFiles} />}
  </div><OrderSummaryBar totalPages={totalPages} totalPrice={totalPrice} isUpdating={isUpdatingPrice} canContinue={canContinue} onContinue={() => setNotification(customizeCopy.reviewReady)} /></main>;
}

function EmptyState({ onAddFiles }: { onAddFiles: (files: FileList | null) => void }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <FileText className="mx-auto size-12 text-ash" />
      <h1 className="mt-4 text-heading-sm font-bold text-midnight">{customizeCopy.emptyTitle}</h1>
      <p className="mt-2 text-body text-ash">{customizeCopy.emptyDescription}</p>
      <label
        htmlFor="empty-state-file-input"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-ecto-green hover:bg-ecto-green/90 text-midnight font-bold px-6 py-3 cursor-pointer select-none active:scale-95 transition-all shadow-xs"
      >
        <Upload className="size-5 stroke-[2.5]" />
        <span>{customizeCopy.addDocument}</span>
      </label>
      <input
        id="empty-state-file-input"
        type="file"
        multiple
        accept={customizeConfig.acceptedFileTypes}
        className="hidden"
        onChange={(e) => {
          onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
