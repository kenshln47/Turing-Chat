// ============================================================================
// Memory module barrel export
// ============================================================================

import type { ConversationMemory } from '../types.js';
import { createIndexedDBMemory } from './indexeddb.js';
import { createInMemoryMemory } from './in-memory.js';

export { createIndexedDBMemory } from './indexeddb.js';
export { createInMemoryMemory } from './in-memory.js';

/** Supported memory backend types. */
export type MemoryType = 'indexeddb' | 'memory';

/**
 * Factory function that creates a {@link ConversationMemory} instance
 * of the specified type.
 *
 * @param type - The backend to use:
 *   - `"indexeddb"` — persistent browser storage (requires IndexedDB).
 *   - `"memory"` — ephemeral in-process `Map`-based storage.
 * @returns A ready-to-use {@link ConversationMemory}.
 *
 * @example
 * ```ts
 * const memory = createMemory('indexeddb');
 * await memory.saveThread(myThread);
 * ```
 */
export function createMemory(type: MemoryType): ConversationMemory {
  switch (type) {
    case 'indexeddb':
      return createIndexedDBMemory();
    case 'memory':
      return createInMemoryMemory();
    default:
      throw new Error(`Unknown memory type: "${type as string}". Supported: indexeddb, memory.`);
  }
}
