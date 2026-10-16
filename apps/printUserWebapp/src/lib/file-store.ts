// Client-side file cache and IndexedDB storage to preserve real File instances and Blob URLs
const clientFileMap = new Map<string, { file: File; url: string }>()

const DB_NAME = "ctrlp_files_store"
const STORE_NAME = "uploaded_files"
/**
 * Files are kept for previews (customize, review, tracking) for as long as a guest session lasts,
 * then pruned, so a shared phone does not hold on to someone's documents.
 */
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB not supported"))
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** One connection per page, pruned of expired files the first time it opens. */
function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDb().then((db) => {
      void pruneExpiredFiles(db)
      return db
    })
    // A failed open (private mode, blocked storage) is tried again on the next call.
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

function pruneExpiredFiles(db: IDBDatabase) {
  return new Promise<void>((resolve) => {
    try {
      const cutoff = Date.now() - CACHE_MAX_AGE_MS
      const tx = db.transaction(STORE_NAME, "readwrite")
      const cursorRequest = tx.objectStore(STORE_NAME).openCursor()
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) return
        // Entries written before `cachedAt` existed have no age, so they go too.
        const cachedAt = (cursor.value as { cachedAt?: number }).cachedAt
        if (typeof cachedAt !== "number" || cachedAt < cutoff) cursor.delete()
        cursor.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function persistFileToIndexedDB(
  id: string,
  file: File
): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put({
      id,
      file,
      name: file.name,
      type: file.type,
      cachedAt: Date.now(),
    })
  } catch (e) {
    console.warn("Could not persist file to IndexedDB:", e)
  }
}

export async function getFileFromIndexedDB(id: string): Promise<File | null> {
  try {
    const db = await getDb()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => resolve(req.result?.file || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export function cacheUploadedFile(id: string, file: File): string {
  if (clientFileMap.has(id)) {
    return clientFileMap.get(id)!.url
  }
  let url = ""
  try {
    url = URL.createObjectURL(file)
  } catch (e) {
    console.error("Failed to create object URL for file:", e)
  }
  clientFileMap.set(id, { file, url })
  persistFileToIndexedDB(id, file)
  return url
}

export function getCachedFile(
  id: string
): { file: File; url: string } | undefined {
  return clientFileMap.get(id)
}

export function getCachedFileUrl(id: string): string | undefined {
  return clientFileMap.get(id)?.url
}

export async function restoreCachedFile(
  id: string
): Promise<{ file: File; url: string } | null> {
  if (clientFileMap.has(id)) return clientFileMap.get(id)!
  const file = await getFileFromIndexedDB(id)
  if (file) {
    let url = ""
    try {
      url = URL.createObjectURL(file)
    } catch {}
    const item = { file, url }
    clientFileMap.set(id, item)
    return item
  }
  return null
}

/** Drops removed documents' files from memory and IndexedDB. Best effort. */
export async function removeCachedFiles(ids: string[]): Promise<void> {
  for (const id of ids) {
    const cached = clientFileMap.get(id)
    if (cached?.url) {
      try {
        URL.revokeObjectURL(cached.url)
      } catch {}
    }
    clientFileMap.delete(id)
  }
  if (ids.length === 0) return
  try {
    const db = await getDb()
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    for (const id of ids) store.delete(id)
  } catch (e) {
    console.warn("Could not remove files from IndexedDB:", e)
  }
}

export function removeCachedFile(id: string): Promise<void> {
  return removeCachedFiles([id])
}
