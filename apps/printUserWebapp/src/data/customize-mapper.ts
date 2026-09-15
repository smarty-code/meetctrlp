import { ConfigurableDocument, UploadedFileItem } from '../types/upload';
import { cloneConfiguration, customizeConfig, defaultPrintConfiguration } from './customize-repository';

type DocumentInput = Pick<ConfigurableDocument, 'id' | 'name' | 'size' | 'type'>;

export function mapFilesToConfigurationDocuments(files: DocumentInput[]): ConfigurableDocument[] {
  return files.map((file, index) => ({
    ...file,
    pageCount: index === 0 ? customizeConfig.defaultPageCount : customizeConfig.additionalPageCount,
    status: 'ready',
    configuration: cloneConfiguration(defaultPrintConfiguration),
  }));
}

export function mapUploadedFilesToDocuments(files: UploadedFileItem[]): ConfigurableDocument[] {
  return mapFilesToConfigurationDocuments(files.map(({ id, name, size, type }) => ({ id, name, size, type })));
}

export function mapStoredFilesToDocuments(files: DocumentInput[], idPrefix: string): ConfigurableDocument[] {
  return mapFilesToConfigurationDocuments(files.map((file, index) => ({ ...file, id: `${idPrefix}-${file.id || index}` })));
}

export function mapFileListToDocuments(fileList: FileList, idPrefix: string): ConfigurableDocument[] {
  return mapStoredFilesToDocuments(Array.from(fileList).map((file) => ({
    id: '',
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
  })), idPrefix);
}

export function copyConfigurationToDocument(configuration: ConfigurableDocument['configuration'], document: ConfigurableDocument): ConfigurableDocument['configuration'] {
  const copied = cloneConfiguration(configuration);
  if (copied.pageSelection.mode === 'selected') {
    copied.pageSelection.pages = copied.pageSelection.pages.filter((page) => page <= document.pageCount);
  }
  return copied;
}