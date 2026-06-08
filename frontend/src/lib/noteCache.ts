/**
 * Local IndexedDB read-only cache for emergency note export.
 *
 * This cache is a safety net — it stores a read-only copy of notes
 * fetched from the API so they can be exported even if the backend
 * is unreachable. It is NEVER authoritative for canonical restore.
 *
 * Uses the raw IndexedDB API to avoid adding a dependency.
 */

const DB_NAME = 'stephane-thinkers-cache'
const DB_VERSION = 1
const STORE_NAME = 'notes'
const META_STORE = 'meta'

interface CachedNote {
  id: string
  title: string
  content: string
  folder_id?: string | null
  thinker_id?: string | null
  note_type?: string | null
  created_at?: string | null
  updated_at?: string | null
  cached_at: string
}

interface RefreshCacheOptions {
  replace?: boolean
}

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'))
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Refresh the local cache with the latest notes from the API response.
 * Call this after successful note fetches to keep the cache fresh.
 */
export async function refreshNoteCache(notes: Array<{
  id: string
  title?: string | null
  content?: string | null
  folder_id?: string | null
  thinker_id?: string | null
  note_type?: string | null
  created_at?: string | null
  updated_at?: string | null
}>, options: RefreshCacheOptions = {}): Promise<void> {
  let db: IDBDatabase | null = null
  try {
    db = await openDB()
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const metaStore = tx.objectStore(META_STORE)

    if (options.replace) {
      store.clear()
    }

    const now = new Date().toISOString()

    for (const note of notes) {
      const cached: CachedNote = {
        id: note.id,
        title: note.title || '',
        content: note.content || '',
        folder_id: note.folder_id,
        thinker_id: note.thinker_id,
        note_type: note.note_type,
        created_at: note.created_at,
        updated_at: note.updated_at,
        cached_at: now,
      }
      store.put(cached)
    }

    metaStore.put({ key: 'last_refresh', value: now, count: notes.length })

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Silently fail — cache is best-effort
    if (typeof indexedDB !== 'undefined') {
      console.warn('[noteCache] Failed to refresh cache')
    }
  } finally {
    db?.close()
  }
}

/**
 * Get all cached notes from IndexedDB.
 */
export async function getCachedNotes(): Promise<CachedNote[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        db.close()
        resolve(request.result as CachedNote[])
      }
      request.onerror = () => {
        db.close()
        reject(request.error)
      }
    })
  } catch {
    return []
  }
}

/**
 * Get cache metadata (last refresh time and count).
 */
export async function getCacheMeta(): Promise<{
  lastRefresh: string | null
  count: number
}> {
  try {
    const db = await openDB()
    const tx = db.transaction(META_STORE, 'readonly')
    const store = tx.objectStore(META_STORE)

    return new Promise((resolve, reject) => {
      const request = store.get('last_refresh')
      request.onsuccess = () => {
        db.close()
        const result = request.result
        resolve({
          lastRefresh: result?.value || null,
          count: result?.count || 0,
        })
      }
      request.onerror = () => {
        db.close()
        reject(request.error)
      }
    })
  } catch {
    return { lastRefresh: null, count: 0 }
  }
}

/**
 * Export all cached notes as a JSON blob for emergency download.
 * Works even when the backend is unreachable.
 */
export async function exportCachedNotesAsBlob(): Promise<Blob> {
  const notes = await getCachedNotes()
  const meta = await getCacheMeta()

  const exportData = {
    type: 'emergency-notes-export',
    exported_at: new Date().toISOString(),
    cache_last_refresh: meta.lastRefresh,
    note_count: notes.length,
    notes,
  }

  return new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  })
}

/**
 * Clear the local note cache.
 */
export async function clearNoteCache(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.objectStore(META_STORE).clear()

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    db.close()
  } catch {
    if (typeof indexedDB !== 'undefined') {
      console.warn('[noteCache] Failed to clear cache')
    }
  }
}

/**
 * Remove a single note from cache (used after successful delete).
 */
export async function removeCachedNote(noteId: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(noteId)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    if (typeof indexedDB !== 'undefined') {
      console.warn('[noteCache] Failed to remove cached note')
    }
  }
}
