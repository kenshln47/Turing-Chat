// ============================================================================
// Mock Provider — deterministic local simulation, no server required
// ============================================================================

import type {
  ChatChunk,
  ChatParams,
  ModelInfo,
  TuringProvider,
} from '../types.js';

/** Behaviour of one simulated model. */
export interface MockModelSpec {
  /** Model name as it appears in the UI. */
  name: string;
  /** Milliseconds before the first token — simulates prompt evaluation. */
  ttftMs?: number;
  /** Decode speed in tokens per second. */
  tokensPerSecond?: number;
  /**
   * Produces the answer text for a prompt. Receives the last user message.
   * Defaults to a generic canned reply that echoes the prompt.
   */
  respond?: (prompt: string) => string;
  /** When set, the model fails with this message instead of answering. */
  failWith?: string;
}

/** Configuration accepted by {@link mockProvider}. */
export interface MockProviderConfig {
  /** Models this provider exposes. Defaults to a varied three-model lineup. */
  models?: MockModelSpec[];
  /**
   * Multiplies every simulated delay. Set to `0` for instant streaming in
   * tests, or `1` for realistic pacing in a demo.
   * @default 1
   */
  speedFactor?: number;
  /** Sleep implementation, injectable for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Default sleep honouring an abort signal. */
function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Splits text into token-ish pieces, keeping whitespace attached. */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

/**
 * A deliberately varied lineup so comparison features have something to show:
 * one fast and terse, one slow and thorough, one middling.
 */
function defaultModels(): MockModelSpec[] {
  return [
    {
      name: 'mock-swift:3b',
      ttftMs: 120,
      tokensPerSecond: 90,
      respond: (prompt) =>
        `Short answer: ${prompt.slice(0, 60)}\n\n` +
        'Here is a compact response with a code sample:\n\n' +
        '```ts\nexport const answer = 42;\n```\n\n' +
        'Done.',
    },
    {
      name: 'mock-sage:14b',
      ttftMs: 800,
      tokensPerSecond: 22,
      respond: (prompt) =>
        `## Considered answer\n\n` +
        `You asked: **${prompt.slice(0, 80)}**\n\n` +
        'Let me work through this carefully.\n\n' +
        '1. First, establish what is being asked.\n' +
        '2. Then, weigh the trade-offs involved.\n' +
        '3. Finally, commit to a recommendation.\n\n' +
        '| Option | Cost | Verdict |\n' +
        '|---|---|---|\n' +
        '| Do it now | Low | Recommended |\n' +
        '| Wait | High | ~~Avoid~~ |\n\n' +
        '```python\ndef solve(x: int) -> int:\n    """Return the answer."""\n    return x * 2\n```\n\n' +
        'In summary, the second option is stronger for most cases.',
    },
    {
      name: 'mock-balanced:7b',
      ttftMs: 340,
      tokensPerSecond: 48,
      respond: (prompt) =>
        `Answering: ${prompt.slice(0, 70)}\n\n` +
        'A balanced take: the practical choice is usually the simplest one ' +
        'that satisfies the constraints.\n\n' +
        '- Fast to build\n- Easy to reverse\n- Cheap to test\n\n' +
        '```bash\nnpm run build\n```',
    },
  ];
}

/**
 * Creates a provider that simulates local models entirely in the browser.
 *
 * Nothing is downloaded and no server is contacted, which makes it the fastest
 * way to try the arena, and it gives tests a provider whose timing and output
 * are fully controlled.
 *
 * @param config - Models and pacing.
 * @returns A {@link TuringProvider} that never touches the network.
 *
 * @example
 * ```ts
 * // Instant streaming, ideal in tests
 * const provider = mockProvider({ speedFactor: 0 });
 * ```
 */
export function mockProvider(config: MockProviderConfig = {}): TuringProvider {
  const models = config.models ?? defaultModels();
  const speedFactor = config.speedFactor ?? 1;
  const sleep = config.sleep ?? defaultSleep;

  function specFor(name: string): MockModelSpec | undefined {
    return models.find((m) => m.name === name);
  }

  async function* chat(params: ChatParams): AsyncGenerator<ChatChunk> {
    const spec = specFor(params.model);

    if (!spec) {
      yield {
        type: 'error',
        error: `Mock provider has no model named "${params.model}".`,
      };
      return;
    }

    if (spec.failWith) {
      yield { type: 'error', error: spec.failWith };
      return;
    }

    const lastUser = [...params.messages].reverse().find((m) => m.role === 'user');
    const prompt = lastUser?.content ?? '';
    const text = spec.respond
      ? spec.respond(prompt)
      : `Echo from ${spec.name}: ${prompt}`;

    // Simulate prompt evaluation before the first token appears.
    await sleep((spec.ttftMs ?? 200) * speedFactor);
    if (params.signal?.aborted) return;

    const tokens = tokenize(text);
    const perToken = 1000 / (spec.tokensPerSecond ?? 40);

    for (const token of tokens) {
      if (params.signal?.aborted) return;
      yield { type: 'token', content: token };
      await sleep(perToken * speedFactor);
    }

    if (params.signal?.aborted) return;

    // Report the timings the simulation was built from, matching the shape a
    // real provider returns so metrics code takes the same path.
    const evalDurationNs = tokens.length * perToken * 1_000_000;
    yield {
      type: 'done',
      model: spec.name,
      evalDuration: evalDurationNs,
      totalDuration: ((spec.ttftMs ?? 200) + tokens.length * perToken) * 1_000_000,
      promptTokens: tokenize(prompt).length,
      completionTokens: tokens.length,
    };
  }

  async function listModels(): Promise<ModelInfo[]> {
    return models.map((m) => ({
      name: m.name,
      size: 0,
      digest: `mock-${m.name}`,
      modifiedAt: new Date(0).toISOString(),
      family: 'mock',
      parameterSize: m.name.split(':')[1] ?? 'unknown',
      quantizationLevel: 'none',
    }));
  }

  async function ping(): Promise<boolean> {
    return true;
  }

  return {
    name: 'mock',
    baseUrl: 'mock://local',
    chat,
    listModels,
    ping,
  };
}
