// ============================================================================
// Presets barrel export
// ============================================================================

import type { AgentPreset } from '../types.js';
import { turingPreset } from './turing.js';
import { coderPreset } from './coder.js';
import { analystPreset } from './analyst.js';

export { turingPreset } from './turing.js';
export { coderPreset } from './coder.js';
export { analystPreset } from './analyst.js';

/** Registry of all built-in presets, keyed by name. */
const presetRegistry: ReadonlyMap<string, AgentPreset> = new Map<string, AgentPreset>([
  [turingPreset.name, turingPreset],
  [coderPreset.name, coderPreset],
  [analystPreset.name, analystPreset],
]);

/** Ordered list of all built-in preset names. */
export const presetNames: readonly string[] = [
  turingPreset.name,
  coderPreset.name,
  analystPreset.name,
];

/**
 * Look up a built-in preset by name.
 *
 * @param name - The preset name (e.g. `"turing"`, `"coder"`, `"analyst"`).
 * @returns The matching {@link AgentPreset}, or `undefined` if not found.
 *
 * @example
 * ```ts
 * const preset = getPreset('turing');
 * if (preset) console.log(preset.systemPrompt);
 * ```
 */
export function getPreset(name: string): AgentPreset | undefined {
  return presetRegistry.get(name);
}

/**
 * Returns all built-in presets as an array.
 */
export function getAllPresets(): AgentPreset[] {
  return Array.from(presetRegistry.values());
}
