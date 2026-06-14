/**
 * @module useModelManager
 * Hook for discovering, pulling, and managing AI models on the local server.
 *
 * @example
 * ```tsx
 * const { models, isLoading, pullModel, deleteModel, activeModel, setActiveModel } =
 *   useModelManager({ baseUrl: 'http://localhost:11434' });
 * ```
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ModelInfo,
  PullProgress,
  TuringProvider,
} from '@turing-chat/core';
import { ollamaProvider } from '@turing-chat/core';

import { TuringContext } from '../context/TuringProvider';

// ────────────────────────────────────────────────────────────────────────────
// Return type
// ────────────────────────────────────────────────────────────────────────────

/** Values returned by {@link useModelManager}. */
export interface UseModelManagerReturn {
  /** Available models from the server. */
  models: ModelInfo[];
  /** Whether the model list is loading. */
  isLoading: boolean;
  /** Error encountered while fetching, if any. */
  error: Error | null;
  /** Refresh the model list from the server. */
  refresh: () => Promise<void>;
  /** Begin pulling (downloading) a model by name. */
  pullModel: (name: string) => void;
  /** Whether a model is currently being pulled. */
  isPulling: boolean;
  /** Current pull progress, or null when idle. */
  pullProgress: PullProgress | null;
  /** Delete a model from the server. */
  deleteModel: (name: string) => Promise<void>;
  /** Currently active model name. */
  activeModel: string;
  /** Change the active model. */
  setActiveModel: (name: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * Manage models available on the AI server.
 *
 * Accepts either a provider instance, a config with `baseUrl`, or — if used
 * inside a `<TuringProvider>` — reads from context automatically.
 */
export function useModelManager(
  providerOrConfig?: TuringProvider | { baseUrl?: string },
): UseModelManagerReturn {
  const ctxValue = useContext(TuringContext);

  // Resolve to a provider instance
  const provider = useMemo<TuringProvider>(() => {
    // Direct TuringProvider instance (duck-type check)
    if (
      providerOrConfig &&
      'chat' in providerOrConfig &&
      typeof (providerOrConfig as TuringProvider).chat === 'function'
    ) {
      return providerOrConfig as TuringProvider;
    }
    // From context
    if (ctxValue) return ctxValue.provider;

    // Create from baseUrl config
    const url =
      (providerOrConfig as { baseUrl?: string } | undefined)?.baseUrl ??
      'http://localhost:11434';

    return ollamaProvider({ baseUrl: url });
  }, [providerOrConfig, ctxValue]);

  // ── State ─────────────────────────────────────────────────────────────
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [activeModel, setActiveModel] = useState(
    ctxValue?.config.model ?? '',
  );

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Fetch model list ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const list = await provider.listModels();
      if (mountedRef.current) {
        setModels(list);
        // Auto-select first model if none is active
        if (!activeModel && list.length > 0) {
          setActiveModel(list[0].name);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [provider, activeModel]);

  // Fetch on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Pull model (consumes async generator from core) ───────────────────
  const pullModel = useCallback(
    (name: string) => {
      if (!provider.pullModel) {
        setError(new Error(`Provider "${provider.name}" does not support pulling models`));
        return;
      }

      setIsPulling(true);
      setPullProgress({ status: 'starting', percent: 0 });

      const pullGen = provider.pullModel;

      void (async () => {
        try {
          for await (const progress of pullGen(name)) {
            if (mountedRef.current) {
              setPullProgress(progress);
            }
          }
          // Refresh list after pull completes
          if (mountedRef.current) {
            setPullProgress(null);
            setIsPulling(false);
            void refresh();
          }
        } catch (err) {
          if (mountedRef.current) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setPullProgress(null);
            setIsPulling(false);
          }
        }
      })();
    },
    [provider, refresh],
  );

  // ── Delete model ──────────────────────────────────────────────────────
  const deleteModel = useCallback(
    async (name: string) => {
      if (!provider.deleteModel) {
        throw new Error(`Provider "${provider.name}" does not support deleting models`);
      }

      try {
        await provider.deleteModel(name);
        if (mountedRef.current) {
          setModels((prev) => prev.filter((m) => m.name !== name));
          if (activeModel === name) {
            setActiveModel('');
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
        throw err;
      }
    },
    [provider, activeModel],
  );

  return {
    models,
    isLoading,
    error,
    refresh,
    pullModel,
    isPulling,
    pullProgress,
    deleteModel,
    activeModel,
    setActiveModel,
  };
}
