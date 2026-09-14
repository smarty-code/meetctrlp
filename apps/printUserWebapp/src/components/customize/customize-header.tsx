import { Button } from '@ctrlp/ui/button';
import { ArrowLeft, Upload } from 'lucide-react';
import { customizeConfig, customizeCopy } from '../../data/customize-repository';

interface CustomizeHeaderProps { onBack: () => void; onAddFiles: (files: FileList | null) => void; fileInputRef: React.RefObject<HTMLInputElement | null>; }

export function CustomizeHeader({ onBack, onAddFiles, fileInputRef }: CustomizeHeaderProps) {
  return <header className="flex min-w-0 items-center gap-2 border-b-2 border-graphite/15 py-4">
    <Button variant="ghost" size="icon" aria-label={customizeCopy.back} onClick={onBack}><ArrowLeft className="size-5" /></Button>
    <p className="min-w-0 flex-1 truncate text-center text-heading-sm font-bold text-midnight">{customizeCopy.title}</p>
    <Button variant="outline" size="sm" className="max-w-[7.5rem] px-2 sm:px-2.5" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" /> <span className="truncate">{customizeCopy.addFiles}</span></Button>
    <input ref={fileInputRef} type="file" multiple accept={customizeConfig.acceptedFileTypes} className="hidden" onChange={(event) => { onAddFiles(event.target.files); event.target.value = ''; }} />
  </header>;
}