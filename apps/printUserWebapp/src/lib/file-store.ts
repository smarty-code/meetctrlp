// Client-side file cache and IndexedDB storage to preserve real File instances and Blob URLs
const clientFileMap = new Map<string, { file: File; url: string }>();

const DB_NAME = 'ctrlp_files_store';
const STORE_NAME = 'uploaded_files';

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistFileToIndexedDB(id: string, file: File): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ id, file, name: file.name, type: file.type });
  } catch (e) {
    console.warn('Could not persist file to IndexedDB:', e);
  }
}

export async function getFileFromIndexedDB(id: string): Promise<File | null> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result?.file || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function cacheUploadedFile(id: string, file: File): string {
  if (clientFileMap.has(id)) {
    return clientFileMap.get(id)!.url;
  }
  let url = '';
  try {
    url = URL.createObjectURL(file);
  } catch (e) {
    console.error('Failed to create object URL for file:', e);
  }
  clientFileMap.set(id, { file, url });
  persistFileToIndexedDB(id, file);
  return url;
}

export function getCachedFile(id: string): { file: File; url: string } | undefined {
  return clientFileMap.get(id);
}

export function getCachedFileUrl(id: string): string | undefined {
  return clientFileMap.get(id)?.url;
}

export async function restoreCachedFile(id: string): Promise<{ file: File; url: string } | null> {
  if (clientFileMap.has(id)) return clientFileMap.get(id)!;
  const file = await getFileFromIndexedDB(id);
  if (file) {
    let url = '';
    try {
      url = URL.createObjectURL(file);
    } catch {}
    const item = { file, url };
    clientFileMap.set(id, item);
    return item;
  }
  return null;
}

