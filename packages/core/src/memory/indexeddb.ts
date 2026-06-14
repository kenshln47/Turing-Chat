// ============================================================================
// IndexedDB-backed ConversationMemory
// ============================================================================

import type { ConversationMemory, Thread } from '../types.js';

/** Database name used by the IndexedDB memory store. */
const DB_NAME = 'turing-chat-memory';
/** Object-store name. */
const STORE_NAME = 'threads';
/** Current schema version. */
const DB_VERSION = 1;

/**
 * Opens (or creates) the IndexedDB database.
 *
 * @returns A promise that resolves with the database handle.
 * @throws When IndexedDB is unavailable (e.g. SSR environments).
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Wraps an IDB request in a `Promise`.
 */
function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Wraps an IDB transaction completion in a `Promise`.
 */
function idbTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/**
 * Creates a {@link ConversationMemory} implementation backed by IndexedDB.
 *
 * Falls back gracefully — the factory itself will succeed, but individual
 * operations will throw if `indexedDB` is not present at call time.
 *
 * @returns A {@link ConversationMemory} instance.
 */
export function createIndexedDBMemory(): ConversationMemory {
  /** Cached database handle (lazy-opened). */
  let dbPromise: Promise<IDBDatabase> | null = null;

  function getDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
      dbPromise = openDB();
    }
    return dbPromise;
  }

  // -----------------------------------------------------------------------
  // CRUD operations
  // -----------------------------------------------------------------------

  async function getThread(id: string): Promise<Thread | null> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await idbRequest(store.get(id));
    return (result as Thread) ?? null;
  }

  async function getAllThreads(): Promise<Thread[]> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('updatedAt');
    const results = await idbRequest(index.getAll());
    // Return newest first
    return (results as Thread[]).reverse();
  }

  async function saveThread(thread: Thread): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(thread);
    await idbTransaction(tx);
  }

  async function deleteThread(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    await idbTransaction(tx);
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  async function searchThreads(query: string): Promise<Thread[]> {
    const threads = await getAllThreads();
    const lowerQuery = query.toLowerCase();

    return threads.filter((thread) => {
      // Search title
      if (thread.title.toLowerCase().includes(lowerQuery)) return true;
      // Search message content
      return thread.messages.some((m) =>
        m.content.toLowerCase().includes(lowerQuery),
      );
    });
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  async function exportAll(): Promise<Thread[]> {
    return getAllThreads();
  }

  async function importAll(threads: Thread[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const thread of threads) {
      store.put(thread);
    }
    await idbTransaction(tx);
  }

  async function clear(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await idbTransaction(tx);
  }

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------
  return {
    getThread,
    getAllThreads,
    saveThread,
    deleteThread,
    searchThreads,
    exportAll,
    importAll,
    clear,
  };
}
