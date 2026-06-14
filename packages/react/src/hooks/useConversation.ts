/**
 * @module useConversation
 * Hook for managing persistent conversation threads backed by
 * {@link ConversationMemory} from `@turing-chat/core`.
 *
 * @example
 * ```tsx
 * const { threads, activeThread, createThread, switchThread } = useConversation(memory);
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateId, type Thread, type ConversationMemory } from '../types/core';

// ────────────────────────────────────────────────────────────────────────────
// Return type
// ────────────────────────────────────────────────────────────────────────────

/** Values returned by {@link useConversation}. */
export interface UseConversationReturn {
  /** All available threads. */
  threads: Thread[];
  /** The currently active thread, or null if none selected. */
  activeThread: Thread | null;
  /** Whether threads are being loaded. */
  isLoading: boolean;
  /** Create a new thread with an optional title. */
  createThread: (title?: string) => Promise<Thread>;
  /** Switch the active thread by ID. */
  switchThread: (id: string) => Promise<void>;
  /** Delete a thread by ID. */
  deleteThread: (id: string) => Promise<void>;
  /** Rename a thread. */
  renameThread: (id: string, title: string) => Promise<void>;
  /** Export all threads as a JSON string. */
  exportThreads: () => Promise<string>;
  /** Import threads from a JSON string. */
  importThreads: (json: string) => Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// In-memory fallback
// ────────────────────────────────────────────────────────────────────────────

/** Minimal in-memory implementation when no ConversationMemory is provided. */
class InMemoryStore implements ConversationMemory {
  private store = new Map<string, Thread>();

  async getThread(id: string): Promise<Thread | null> {
    return this.store.get(id) ?? null;
  }

  async getAllThreads(): Promise<Thread[]> {
    return Array.from(this.store.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  async saveThread(thread: Thread): Promise<void> {
    this.store.set(thread.id, thread);
  }

  async deleteThread(id: string): Promise<void> {
    this.store.delete(id);
  }

  async searchThreads(query: string): Promise<Thread[]> {
    const q = query.toLowerCase();
    return Array.from(this.store.values()).filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }

  async exportAll(): Promise<Thread[]> {
    return Array.from(this.store.values());
  }

  async importAll(threads: Thread[]): Promise<void> {
    for (const t of threads) {
      this.store.set(t.id, t);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * Manage persistent conversation threads.
 *
 * If no `ConversationMemory` instance is provided, an in-memory fallback
 * is used (data is lost on page refresh).
 *
 * @param memory - An optional `ConversationMemory` instance from `@turing-chat/core`.
 */
export function useConversation(
  memory?: ConversationMemory,
): UseConversationReturn {
  // Use the provided memory or an in-memory fallback
  const storeRef = useRef<ConversationMemory>(
    memory ?? new InMemoryStore(),
  );

  // Update ref if memory prop changes
  useEffect(() => {
    if (memory) {
      storeRef.current = memory;
    }
  }, [memory]);

  const store = storeRef.current;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load threads on mount ─────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await store.getAllThreads();
      if (mountedRef.current) {
        const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
        setThreads(sorted);
      }
    } catch (err) {
      console.error('[turing-chat] Failed to load threads:', err);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // ── Create thread ─────────────────────────────────────────────────────
  const createThread = useCallback(
    async (title?: string): Promise<Thread> => {
      const now = Date.now();
      const thread: Thread = {
        id: generateId(),
        title: title ?? 'New Conversation',
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      await store.saveThread(thread);
      if (mountedRef.current) {
        setThreads((prev) => [thread, ...prev]);
        setActiveThread(thread);
      }
      return thread;
    },
    [store],
  );

  // ── Switch thread ─────────────────────────────────────────────────────
  const switchThread = useCallback(
    async (id: string) => {
      const thread = await store.getThread(id);
      if (thread && mountedRef.current) {
        setActiveThread(thread);
      }
    },
    [store],
  );

  // ── Delete thread ─────────────────────────────────────────────────────
  const deleteThread = useCallback(
    async (id: string) => {
      await store.deleteThread(id);
      if (mountedRef.current) {
        setThreads((prev) => prev.filter((t) => t.id !== id));
        if (activeThread?.id === id) {
          setActiveThread(null);
        }
      }
    },
    [store, activeThread],
  );

  // ── Rename thread ─────────────────────────────────────────────────────
  const renameThread = useCallback(
    async (id: string, title: string) => {
      const thread = await store.getThread(id);
      if (thread) {
        const updated = {
          ...thread,
          title,
          updatedAt: Date.now(),
        };
        await store.saveThread(updated);
        if (mountedRef.current) {
          setThreads((prev) =>
            prev.map((t) => (t.id === id ? updated : t)),
          );
          if (activeThread?.id === id) {
            setActiveThread(updated);
          }
        }
      }
    },
    [store, activeThread],
  );

  // ── Export threads ────────────────────────────────────────────────────
  const exportThreads = useCallback(async (): Promise<string> => {
    const list = await store.exportAll();
    return JSON.stringify(list, null, 2);
  }, [store]);

  // ── Import threads ────────────────────────────────────────────────────
  const importThreads = useCallback(
    async (json: string) => {
      const parsed: Thread[] = JSON.parse(json);
      await store.importAll(parsed);
      await loadThreads();
    },
    [store, loadThreads],
  );

  return {
    threads,
    activeThread,
    isLoading,
    createThread,
    switchThread,
    deleteThread,
    renameThread,
    exportThreads,
    importThreads,
  };
}
