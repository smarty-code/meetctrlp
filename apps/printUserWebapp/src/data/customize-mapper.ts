import { ConfigurableDocument, UploadedFileItem } from '../types/upload';
import { cloneConfiguration, customizeConfig, defaultPrintConfiguration } from './customize-repository';
import { cacheUploadedFile, getCachedFile, getCachedFileUrl } from '../lib/file-store';

type DocumentInput = Pick<ConfigurableDocument, 'id' | 'name' | 'size' | 'type'> & { previewUrl?: string };

export function mapFilesToConfigurationDocuments(files: DocumentInput[]): ConfigurableDocument[] {
  return files.map((file, index) => {
    const cached = getCachedFile(file.id);
    const previewUrl = file.previewUrl || cached?.url || getCachedFileUrl(file.id);
    const realFile = cached?.file;
    const isImage = file.type.startsWith('image/');

    return {
      ...file,
      file: realFile,
      previewUrl: previewUrl || undefined,
      pageCount: isImage ? 1 : (index === 0 ? customizeConfig.defaultPageCount : customizeConfig.additionalPageCount),
      status: 'ready',
      configuration: cloneConfiguration(defaultPrintConfiguration),
    };
  });
}

export function mapUploadedFilesToDocuments(files: UploadedFileItem[]): ConfigurableDocument[] {
  return mapFilesToConfigurationDocuments(
    files.map(({ id, name, size, type, previewUrl }) => ({ id, name, size, type, previewUrl }))
  );
}

export function mapStoredFilesToDocuments(files: DocumentInput[], idPrefix: string): ConfigurableDocument[] {
  return mapFilesToConfigurationDocuments(
    files.map((file, index) => ({
      ...file,
      id: file.id || `${idPrefix}-${index}`,
    }))
  );
}

export function mapFileListToDocuments(fileList: FileList, idPrefix: string): ConfigurableDocument[] {
  const items = Array.from(fileList).map((file, idx) => {
    const id = `${idPrefix}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
    const previewUrl = cacheUploadedFile(id, file);
    return {
      id,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      previewUrl,
    };
  });
  return mapFilesToConfigurationDocuments(items);
}

export function copyConfigurationToDocument(configuration: ConfigurableDocument['configuration'], document: ConfigurableDocument): ConfigurableDocument['configuration'] {
  const copied = cloneConfiguration(configuration);
  if (copied.pageSelection.mode === 'selected') {
    copied.pageSelection.pages = copied.pageSelection.pages.filter((page) => page <= document.pageCount);
  }
  return copied;
}