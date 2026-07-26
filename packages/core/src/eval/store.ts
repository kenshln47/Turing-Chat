// ============================================================================
// Evaluation store — persist arena runs & prompt suites
// ============================================================================

import type { ArenaRun, PromptSuite } from './types.js';

/** A portable snapshot of everything the store holds. */
export interface EvalArchive {
  /** Schema version, so future imports can migrate old files. */
  version: 1;
  /** When the archive was produced. */
  exportedAt: number;
  /** Every recorded run. */
  runs: ArenaRun[];
  /** Every saved suite. */
  suites: PromptSuite[];
}

/** Persistence for arena runs and prompt suites. */
export interface EvalStore {
  /** Create or replace a run. */
  saveRun(run: ArenaRun): Promise<void>;
  /** Fetch a run, or `null` when it does not exist. */
  getRun(id: string): Promise<ArenaRun | null>;
  /** Every run, newest first. */
  listRuns(): Promise<ArenaRun[]>;
  /** Remove a run. */
  deleteRun(id: string): Promise<void>;

  /** Create or replace a suite. */
  saveSuite(suite: PromptSuite): Promise<void>;
  /** Fetch a suite, or `null` when it does not exist. */
  getSuite(id: string): Promise<PromptSuite | null>;
  /** Every suite, most recently updated first. */
  listSuites(): Promise<PromptSuite[]>;
  /** Remove a suite. */
  deleteSuite(id: string): Promise<void>;

  /** Remove everything. */
  clear(): Promise<void>;
  /** Snapshot the whole store for backup. */
  exportAll(): Promise<EvalArchive>;
  /** Merge an archive into the store, overwriting entries with matching ids. */
  importAll(archive: EvalArchive): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory
// ---------------------------------------------------------------------------

/**
 * Creates an {@link EvalStore} held entirely in memory.
 *
 * Used as the automatic fallback when IndexedDB is unavailable — server-side
 * rendering, tests, or a browser with storage disabled.
 */
export function createInMemoryEvalStore(): EvalStore {
  const runs = new Map<string, ArenaRun>();
  const suites = new Map<string, PromptSuite>();

  return {
    async saveRun(run) {
      runs.set(run.id, run);
    },
    async getRun(id) {
      return runs.get(id) ?? null;
    },
    async listRuns() {
      return [...runs.values()].sort((a, b) => b.createdAt - a.createdAt);
    },
    async deleteRun(id) {
      runs.delete(id);
    },
    async saveSuite(suite) {
      suites.set(suite.id, suite);
    },
    async getSuite(id) {
      return suites.get(id) ?? null;
    },
    async listSuites() {
      return [...suites.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async deleteSuite(id) {
      suites.delete(id);
    },
    async clear() {
      runs.clear();
      suites.clear();
    },
    async exportAll() {
      return {
        version: 1,
        exportedAt: Date.now(),
        runs: [...runs.values()],
        suites: [...suites.values()],
      };
    },
    async importAll(archive) {
      for (const run of archive.runs ?? []) runs.set(run.id, run);
      for (const suite of archive.suites ?? []) suites.set(suite.id, suite);
    },
  };
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

const DB_NAME = 'turing-chat-eval';
const DB_VERSION = 1;
const RUNS_STORE = 'runs';
const SUITES_STORE = 'suites';

/** True when IndexedDB can be used in the current environment. */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        const store = db.createObjectStore(RUNS_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(SUITES_STORE)) {
        const store = db.createObjectStore(SUITES_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/**
 * Creates an {@link EvalStore} backed by IndexedDB.
 *
 * Runs and suites live in a database of their own, separate from conversation
 * history, so clearing chat threads never destroys accumulated benchmark data.
 */
export function createIndexedDBEvalStore(): EvalStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function getDB(): Promise<IDBDatabase> {
    if (!dbPromise) dbPromise = openDB();
    return dbPromise;
  }

  async function put<T>(storeName: string, value: T): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    await idbTransaction(tx);
  }

  async function get<T>(storeName: string, id: string): Promise<T | null> {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readonly');
    const result = await idbRequest(tx.objectStore(storeName).get(id));
    return (result as T) ?? null;
  }

  async function getAll<T>(storeName: string, indexName: string): Promise<T[]> {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const results = await idbRequest(index.getAll());
    // The index is ascending; the UI always wants newest first.
    return (results as T[]).reverse();
  }

  async function remove(storeName: string, id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    await idbTransaction(tx);
  }

  return {
    saveRun: (run) => put(RUNS_STORE, run),
    getRun: (id) => get<ArenaRun>(RUNS_STORE, id),
    listRuns: () => getAll<ArenaRun>(RUNS_STORE, 'createdAt'),
    deleteRun: (id) => remove(RUNS_STORE, id),

    saveSuite: (suite) => put(SUITES_STORE, suite),
    getSuite: (id) => get<PromptSuite>(SUITES_STORE, id),
    listSuites: () => getAll<PromptSuite>(SUITES_STORE, 'updatedAt'),
    deleteSuite: (id) => remove(SUITES_STORE, id),

    async clear() {
      const db = await getDB();
      const tx = db.transaction([RUNS_STORE, SUITES_STORE], 'readwrite');
      tx.objectStore(RUNS_STORE).clear();
      tx.objectStore(SUITES_STORE).clear();
      await idbTransaction(tx);
    },

    async exportAll() {
      const [runs, suites] = await Promise.all([
        getAll<ArenaRun>(RUNS_STORE, 'createdAt'),
        getAll<PromptSuite>(SUITES_STORE, 'updatedAt'),
      ]);
      return { version: 1, exportedAt: Date.now(), runs, suites };
    },

    async importAll(archive) {
      const db = await getDB();
      const tx = db.transaction([RUNS_STORE, SUITES_STORE], 'readwrite');
      for (const run of archive.runs ?? []) tx.objectStore(RUNS_STORE).put(run);
      for (const suite of archive.suites ?? []) tx.objectStore(SUITES_STORE).put(suite);
      await idbTransaction(tx);
    },
  };
}

/**
 * Returns an IndexedDB-backed store when the environment supports it and an
 * in-memory store otherwise, so the same call works during SSR and in tests.
 */
export function createEvalStore(): EvalStore {
  return isIndexedDBAvailable()
    ? createIndexedDBEvalStore()
    : createInMemoryEvalStore();
}
