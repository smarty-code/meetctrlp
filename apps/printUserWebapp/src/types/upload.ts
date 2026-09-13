export type ShopStatus = 'OPEN' | 'BUSY' | 'TEMPORARILY_UNAVAILABLE' | 'CLOSED';

export interface ShopContext {
  id: string;
  name: string;
  address: string;
  status: ShopStatus;
  statusMessage?: string;
  estimatedMinutes: number;
  startingPriceA4: number;
  openTime?: string;
  closeTime?: string;
}

export interface UploadedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  pageCount?: number;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
  previewUrl?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}
