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
import {
  generateId,
  type Message,
  type Thread,
  type ConversationMemory,
} from '../types/core';

/** Longest auto-generated thread title, in characters. */
const MAX_AUTO_TITLE_LENGTH = 60;

/** Title given to a thread before its first user message arrives. */
const UNTITLED = 'New Conversation';

/**
 * Derives a thread title from the first user message.
 *
 * Titles come from the user's own words rather than a model call, so naming
 * costs nothing and works identically offline.
 */
function deriveTitle(messages: Message[]): string | null {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return null;

  const flat = firstUser.content.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return null;

  return flat.length > MAX_AUTO_TITLE_LENGTH
    ? `${flat.slice(0, MAX_AUTO_TITLE_LENGTH).trimEnd()}…`
    : flat;
}

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
  /** Switch the active thread by ID, returning it so callers can load its messages. */
  switchThread: (id: string) => Promise<Thread | null>;
  /**
   * Begin a new conversation without writing anything yet.
   *
   * Nothing is persisted until the first message arrives, so opening a new
   * chat and changing your mind never leaves an empty thread behind.
   */
  startNewThread: () => void;
  /**
   * Write messages into the active thread, creating one on first use and
   * naming it from the first user message.
   *
   * @returns The saved thread, or `null` when there was nothing to save.
   */
  saveMessages: (messages: Message[]) => Promise<Thread | null>;
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

  // The active thread is mirrored in a ref so a save triggered by rapid
  // streaming updates always sees the current thread rather than the one
  // captured when the callback was created.
  const activeThreadRef = useRef<Thread | null>(null);
  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

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
      activeThreadRef.current = thread;
      return thread;
    },
    [store],
  );

  // ── Start a new conversation ──────────────────────────────────────────
  const startNewThread = useCallback(() => {
    activeThreadRef.current = null;
    setActiveThread(null);
  }, []);

  // ── Switch thread ─────────────────────────────────────────────────────
  const switchThread = useCallback(
    async (id: string): Promise<Thread | null> => {
      const thread = await store.getThread(id);
      if (thread && mountedRef.current) {
        setActiveThread(thread);
      }
      return thread;
    },
    [store],
  );

  // ── Persist messages ──────────────────────────────────────────────────
  const saveMessages = useCallback(
    async (messages: Message[]): Promise<Thread | null> => {
      if (messages.length === 0) return null;

      const now = Date.now();
      const existing = activeThreadRef.current;

      const base: Thread = existing ?? {
        id: generateId(),
        title: UNTITLED,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };

      // Keep a manually chosen title; only fill in one we generated ourselves.
      const title =
        base.title === UNTITLED ? (deriveTitle(messages) ?? base.title) : base.title;

      const updated: Thread = { ...base, title, messages, updatedAt: now };

      await store.saveThread(updated);

      if (mountedRef.current) {
        activeThreadRef.current = updated;
        setActiveThread(updated);
        setThreads((prev) => {
          const without = prev.filter((t) => t.id !== updated.id);
          return [updated, ...without];
        });
      }

      return updated;
    },
    [store],
  );

  // ── Delete thread ─────────────────────────────────────────────────────
  const deleteThread = useCallback(
    async (id: string) => {
      await store.deleteThread(id);
      if (mountedRef.current) {
        setThreads((prev) => prev.filter((t) => t.id !== id));
        if (activeThreadRef.current?.id === id) {
          activeThreadRef.current = null;
          setActiveThread(null);
        }
      }
    },
    [store],
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
          if (activeThreadRef.current?.id === id) {
            activeThreadRef.current = updated;
            setActiveThread(updated);
          }
        }
      }
    },
    [store],
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
    startNewThread,
    saveMessages,
    deleteThread,
    renameThread,
    exportThreads,
    importThreads,
  };
}
