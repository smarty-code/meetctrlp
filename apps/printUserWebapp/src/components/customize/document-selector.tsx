import { Button } from '@ctrlp/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { customizeCopy } from '../../data/customize-repository';
import { ConfigurableDocument } from '../../types/upload';
import { DocumentPreview } from './document-preview';

interface DocumentSelectorProps { documents: ConfigurableDocument[]; selectedId: string; previewPage: number; onSelect: (id: string) => void; onMove: (offset: number) => void; onPreviewPage: (page: number) => void; }

export function DocumentSelector({ documents, selectedId, previewPage, onSelect, onMove, onPreviewPage }: DocumentSelectorProps) {
  const document = documents.find((item) => item.id === selectedId) ?? documents[0];
  const position = documents.findIndex((item) => item.id === document.id) + 1;
  return <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-8" aria-label={customizeCopy.preview}>
    <div className="flex w-full items-center justify-between">
      <Button variant="ghost" size="icon" aria-label={customizeCopy.previousDocument} onClick={() => onMove(-1)} disabled={documents.length < 2}><ChevronLeft /></Button>
      <div className="text-caption font-bold text-ash" aria-live="polite">{customizeCopy.documentPosition(position, documents.length)}</div>
      <Button variant="ghost" size="icon" aria-label={customizeCopy.nextDocument} onClick={() => onMove(1)} disabled={documents.length < 2}><ChevronRight /></Button>
    </div>
    <DocumentPreview document={document} />
    <div className="flex items-center gap-2" aria-label={customizeCopy.selectDocument}>{documents.map((item) => <button key={item.id} type="button" aria-label={item.name} aria-pressed={item.id === selectedId} onClick={() => onSelect(item.id)} className={`h-2.5 rounded-full border border-graphite transition-all ${item.id === selectedId ? 'w-8 bg-ecto-green' : 'w-2.5 bg-paper'}`} />)}</div>
    {document.pageCount > 1 && <div className="flex items-center gap-3 text-caption font-bold text-ash"><Button variant="outline" size="icon-sm" aria-label={customizeCopy.previousDocument} onClick={() => onPreviewPage(Math.max(1, previewPage - 1))} disabled={previewPage === 1}><ChevronLeft /></Button>{customizeCopy.previewPageCount(previewPage, document.pageCount)}<Button variant="outline" size="icon-sm" aria-label={customizeCopy.nextDocument} onClick={() => onPreviewPage(Math.min(document.pageCount, previewPage + 1))} disabled={previewPage === document.pageCount}><ChevronRight /></Button></div>}
  </section>;
}