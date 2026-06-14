// ============================================================================
// In-memory ConversationMemory (Map-based)
// ============================================================================

import type { ConversationMemory, Thread } from '../types.js';

/**
 * Creates a simple in-memory {@link ConversationMemory} implementation.
 *
 * Data lives only for the lifetime of the JavaScript process. Useful for
 * testing, server-side rendering, or environments without IndexedDB.
 *
 * @returns A {@link ConversationMemory} instance.
 */
export function createInMemoryMemory(): ConversationMemory {
  const store = new Map<string, Thread>();

  async function getThread(id: string): Promise<Thread | null> {
    return store.get(id) ?? null;
  }

  async function getAllThreads(): Promise<Thread[]> {
    return Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function saveThread(thread: Thread): Promise<void> {
    store.set(thread.id, structuredClone(thread));
  }

  async function deleteThread(id: string): Promise<void> {
    store.delete(id);
  }

  async function searchThreads(query: string): Promise<Thread[]> {
    const lowerQuery = query.toLowerCase();
    const all = await getAllThreads();
    return all.filter((thread) => {
      if (thread.title.toLowerCase().includes(lowerQuery)) return true;
      return thread.messages.some((m) =>
        m.content.toLowerCase().includes(lowerQuery),
      );
    });
  }

  async function exportAll(): Promise<Thread[]> {
    return getAllThreads();
  }

  async function importAll(threads: Thread[]): Promise<void> {
    for (const thread of threads) {
      store.set(thread.id, structuredClone(thread));
    }
  }

  async function clear(): Promise<void> {
    store.clear();
  }

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
