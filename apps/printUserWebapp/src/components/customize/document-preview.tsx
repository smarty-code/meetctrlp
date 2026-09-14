import { FileImage, FileText } from 'lucide-react';
import { ConfigurableDocument } from '../../types/upload';
import { customizeCopy } from '../../data/customize-repository';

export function DocumentPreview({ document }: { document: ConfigurableDocument }) {
  const isImage = document.type.startsWith('image/');
  return (
    <div className="relative aspect-3/4 w-full max-w-62.5 overflow-hidden rounded-xl border-2 border-graphite bg-paper p-5 text-midnight">
      <div className="flex h-full flex-col gap-4 border border-graphite/15 p-4">
        <div className="flex items-center justify-between border-b-2 border-ecto-green pb-3">
          {isImage ? <FileImage className="size-8 text-macaw-blue" /> : <FileText className="size-8 text-ecto-green" />}
          <span className="text-caption font-bold text-ash">{customizeCopy.paperSize}</span>
        </div>
        <div className="space-y-2"><div className="h-3 w-4/5 rounded-sm bg-midnight/80" /><div className="h-2 w-full rounded-sm bg-graphite/20" /><div className="h-2 w-11/12 rounded-sm bg-graphite/20" /><div className="h-2 w-3/4 rounded-sm bg-graphite/20" /></div>
        <div className="mt-auto border-t border-graphite/15 pt-3 text-caption font-bold text-ash">{customizeCopy.pages(document.pageCount)}</div>
      </div>
    </div>
  );
}