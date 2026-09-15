import { Button } from '@ctrlp/ui/button';
import { Minus, Plus, X } from 'lucide-react';
import { customizeCopy } from '../../data/customize-repository';
import { ConfigurableDocument } from '../../types/upload';

interface DocumentConfigurationCardProps { document: ConfigurableDocument; onRemove: () => void; onCopiesChange: (copies: number) => void; }

export function DocumentConfigurationCard({ document, onRemove, onCopiesChange }: DocumentConfigurationCardProps) {
  return <div className="rounded-xl border-2 border-graphite bg-paper p-4 sm:p-5 lg:col-span-2">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0"><h1 className="truncate text-heading-sm font-bold text-midnight">{document.name}</h1><p className="text-caption text-ash">{customizeCopy.fileMeta(document.pageCount, formatFileSize(document.size))}</p></div>
      <Button variant="ghost" size="icon" aria-label={`${customizeCopy.remove} ${document.name}`} onClick={onRemove}><X className="size-5 text-ash" /></Button>
    </div>
    <div className="mt-5 flex items-center justify-between gap-4"><div><p className="font-bold text-midnight">{customizeCopy.copies}</p><p className="text-caption text-ash">{customizeCopy.copiesHint}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label={customizeCopy.decreaseCopies} onClick={() => onCopiesChange(Math.max(1, document.configuration.copies - 1))} disabled={document.configuration.copies === 1}><Minus /></Button><span className="w-8 text-center text-heading-sm font-bold text-midnight">{document.configuration.copies}</span><Button variant="outline" size="icon" aria-label={customizeCopy.increaseCopies} onClick={() => onCopiesChange(document.configuration.copies + 1)}><Plus /></Button></div></div>
  </div>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}