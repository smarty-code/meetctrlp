'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@ctrlp/ui/button';
import { FileText, Upload } from 'lucide-react';
import { ApplyToAll } from '../../components/customize/apply-to-all';
import { ColorSelector } from '../../components/customize/color-selector';
import { CustomizeHeader } from '../../components/customize/customize-header';
import { DocumentConfigurationCard } from '../../components/customize/document-configuration-card';
import { DocumentSelector } from '../../components/customize/document-selector';
import { OrderSummaryBar } from '../../components/customize/order-summary-bar';
import { PageSelectionControl } from '../../components/customize/page-selection-control';
import { PaperSizeSelector } from '../../components/customize/paper-size-selector';
import { customizeConfig, customizeCopy, mockConfigurationDocuments } from '../../data/customize-repository';
import { copyConfigurationToDocument, mapStoredFilesToDocuments, mapFileListToDocuments } from '../../data/customize-mapper';
import { isPageSelectionValid, parsePageSelection } from '../../lib/page-selection';
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
  return document.configuration.pageSelection.mode === 'all' ? document.pageCount : document.configuration.pageSelection.pages.length;
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

  const updateDocument = (id: string, configuration: Partial<PrintConfiguration>) => {
    setIsUpdatingPrice(true);
    setDocuments((current) => current.map((document) => document.id === id ? { ...document, configuration: { ...document.configuration, ...configuration } } : document));
    window.setTimeout(() => setIsUpdatingPrice(false), customizeConfig.priceUpdateDuration);
  };

  const updatePageSelection = (mode: 'all' | 'selected', expression = '') => {
    if (!selectedDocument) return;
    updateDocument(selectedDocument.id, { pageSelection: { mode, expression, pages: mode === 'all' ? [] : parsePageSelection(expression, selectedDocument.pageCount) } });
  };

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setDocuments((current) => [...current, ...mapFileListToDocuments(fileList, `added-${Date.now()}`)]);
  };

  const removeSelected = () => {
    if (!selectedDocument) return;
    const remaining = documents.filter((document) => document.id !== selectedDocument.id);
    setDocuments(remaining);
    setSelectedId(remaining[0]?.id ?? '');
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
  const canContinue = documents.length > 0 && documents.every((document) => document.status === 'ready' && (document.configuration.pageSelection.mode === 'all' || isPageSelectionValid(document.configuration.pageSelection.expression, document.pageCount))) && !isUpdatingPrice;

  return <main className="min-h-screen bg-paper pb-36 text-charcoal"><div className="mx-auto w-full max-w-300 px-4 sm:px-6">
    <CustomizeHeader onBack={() => router.push('/')} onAddFiles={handleAddFiles} fileInputRef={fileInputRef} />
    {notification && <div className="mt-4 border-2 border-ecto-green bg-eel-light px-4 py-3 text-body font-bold text-midnight">{notification}</div>}
    {selectedDocument ? <>
      <DocumentSelector documents={documents} selectedId={selectedDocument.id} previewPage={previewPage} onSelect={(id) => { setSelectedId(id); setPreviewPage(1); }} onMove={moveDocument} onPreviewPage={setPreviewPage} />
      <section className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-2" aria-label={customizeCopy.preview}>
        <DocumentConfigurationCard document={selectedDocument} onRemove={removeSelected} onCopiesChange={(copies) => updateDocument(selectedDocument.id, { copies: Math.min(customizeConfig.maxCopies, copies) })} />
        <ColorSelector value={selectedDocument.configuration.colorMode} onChange={(colorMode) => updateDocument(selectedDocument.id, { colorMode })} />
        <PaperSizeSelector />
        <PageSelectionControl mode={selectedDocument.configuration.pageSelection.mode} expression={selectedDocument.configuration.pageSelection.expression} pageCount={selectedDocument.pageCount} onChange={updatePageSelection} isValid={isPageSelectionValid(selectedDocument.configuration.pageSelection.expression, selectedDocument.pageCount)} />
        <ApplyToAll onApply={applyToAll} />
      </section>
    </> : <EmptyState onAdd={() => fileInputRef.current?.click()} />}
  </div><OrderSummaryBar totalPages={totalPages} totalPrice={totalPrice} isUpdating={isUpdatingPrice} canContinue={canContinue} onContinue={() => setNotification(customizeCopy.reviewReady)} /></main>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="mx-auto max-w-md py-24 text-center"><FileText className="mx-auto size-12 text-ash" /><h1 className="mt-4 text-heading-sm font-bold text-midnight">{customizeCopy.emptyTitle}</h1><p className="mt-2 text-body text-ash">{customizeCopy.emptyDescription}</p><Button className="mt-6" onClick={onAdd}><Upload /> {customizeCopy.addDocument}</Button></div>;
}
