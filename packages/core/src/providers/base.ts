// ============================================================================
// Provider base — re-exports & factory helper
// ============================================================================

import type { TuringProvider } from '../types.js';

export type { TuringProvider };

/** Configuration accepted by {@link createProvider}. */
export interface ProviderConfig {
  /** Provider type identifier. */
  type: 'ollama' | 'lm-studio' | 'mock' | (string & {});
  /** Override the default base URL for the provider. */
  baseUrl?: string;
}

/**
 * Convenience factory that instantiates a provider by name.
 *
 * ```ts
 * const provider = await createProvider({ type: 'ollama' });
 * ```
 *
 * @param config - Provider selector and optional overrides.
 * @returns A fully initialised {@link TuringProvider}.
 * @throws If the provider type is unknown.
 */
export async function createProvider(config: ProviderConfig): Promise<TuringProvider> {
  switch (config.type) {
    case 'ollama': {
      const { ollamaProvider } = await import('./ollama.js');
      return ollamaProvider({ baseUrl: config.baseUrl });
    }
    case 'lm-studio': {
      const { lmStudioProvider } = await import('./lmstudio.js');
      return lmStudioProvider({ baseUrl: config.baseUrl });
    }
    case 'mock': {
      const { mockProvider } = await import('./mock.js');
      return mockProvider();
    }
    default:
      throw new Error(
        `Unknown provider type: "${config.type}". Supported: ollama, lm-studio, mock.`,
      );
  }
}
