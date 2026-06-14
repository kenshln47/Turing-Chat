// ============================================================================
// ToolRegistry — register, look up, and execute tools
// ============================================================================

import type { ToolDefinition, ExecutableTool } from '../types.js';

/**
 * A registry that manages {@link ExecutableTool} instances.
 *
 * Provides methods to register tools, retrieve definitions in the format
 * expected by providers, and execute tools by name.
 *
 * @example
 * ```ts
 * const registry = new ToolRegistry();
 *
 * registry.register({
 *   name: 'get_weather',
 *   description: 'Get the current weather for a location.',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       location: { type: 'string', description: 'City name' },
 *     },
 *     required: ['location'],
 *   },
 *   execute: async (args) => {
 *     return { temp: 22, unit: 'C', location: args.location };
 *   },
 * });
 *
 * const defs = registry.toDefinitions(); // pass to provider
 * const result = await registry.execute('get_weather', { location: 'Berlin' });
 * ```
 */
export class ToolRegistry {
  /** Internal store of registered tools. */
  private readonly tools = new Map<string, ExecutableTool>();

  /**
   * Register a tool. If a tool with the same name already exists it will be
   * overwritten.
   *
   * @param tool - The executable tool definition.
   * @returns `this` for method chaining.
   */
  register(tool: ExecutableTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  /**
   * Retrieve a registered tool by name.
   *
   * @param name - Tool name.
   * @returns The tool, or `undefined` if not registered.
   */
  get(name: string): ExecutableTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check whether a tool with the given name is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool from the registry.
   *
   * @param name - Tool name.
   * @returns `true` if the tool existed and was removed.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Return every registered tool as an array.
   */
  getAll(): ExecutableTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Return the number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Execute a registered tool by name.
   *
   * @param name - Tool name.
   * @param args - Arguments to pass to the tool's `execute` function.
   * @returns The value returned by the tool.
   * @throws If no tool with the given name is registered.
   */
  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered.`);
    }
    return tool.execute(args);
  }

  /**
   * Convert all registered tools to an array of {@link ToolDefinition}
   * objects suitable for passing to a provider's `chat()` method.
   *
   * The returned definitions do **not** include the `execute` function —
   * only the schema data the model needs to decide whether to call a tool.
   */
  toDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Remove all tools from the registry.
   */
  clear(): void {
    this.tools.clear();
  }
}
