// ============================================================================
// NDJSON & SSE streaming parsers
// ============================================================================

/**
 * Parses a `ReadableStream<Uint8Array>` containing newline-delimited JSON
 * (NDJSON). Each non-empty line is parsed as an independent JSON value.
 *
 * @param stream - The raw byte stream to consume.
 * @yields Parsed JSON objects, one per line.
 */
export async function* parseNDJSON<T = unknown>(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush any remaining content in the buffer
        const remaining = buffer.trim();
        if (remaining.length > 0) {
          try {
            yield JSON.parse(remaining) as T;
          } catch {
            // Ignore trailing non-JSON (e.g. empty line)
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Split on newlines, keeping the last (potentially incomplete) chunk
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        try {
          yield JSON.parse(trimmed) as T;
        } catch {
          // Skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** A single Server-Sent Event. */
export interface SSEEvent {
  /** Event name (defaults to `"message"` per the SSE spec). */
  event: string;
  /** The `data:` payload (multiple `data:` lines are joined with `\n`). */
  data: string;
  /** Optional event ID. */
  id?: string;
}

/**
 * Parses a `ReadableStream<Uint8Array>` of Server-Sent Events (SSE).
 *
 * Handles multi-line `data:` fields, event names, IDs, and the OpenAI
 * `[DONE]` sentinel. Each yielded {@link SSEEvent} represents one complete
 * event block.
 *
 * @param stream - The raw byte stream to consume.
 * @yields Parsed SSE events (the `[DONE]` marker is silently consumed).
 */
export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Accumulator for the current event being assembled
  let eventType = 'message';
  let dataLines: string[] = [];
  let eventId: string | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush any accumulated event
        if (dataLines.length > 0) {
          const data = dataLines.join('\n');
          if (data !== '[DONE]') {
            yield { event: eventType, data, id: eventId };
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');

        // An empty line marks the end of an event block
        if (line === '') {
          if (dataLines.length > 0) {
            const data = dataLines.join('\n');
            if (data === '[DONE]') {
              // OpenAI termination sentinel — stop iteration
              return;
            }
            yield { event: eventType, data, id: eventId };
          }
          // Reset for next event
          eventType = 'message';
          dataLines = [];
          eventId = undefined;
          continue;
        }

        // Comment lines (start with ':') are ignored per the spec
        if (line.startsWith(':')) continue;

        const colonIdx = line.indexOf(':');
        let field: string;
        let val: string;

        if (colonIdx === -1) {
          field = line;
          val = '';
        } else {
          field = line.slice(0, colonIdx);
          // Strip the optional leading space after the colon
          val = line.slice(colonIdx + 1).replace(/^ /, '');
        }

        switch (field) {
          case 'data':
            dataLines.push(val);
            break;
          case 'event':
            eventType = val;
            break;
          case 'id':
            eventId = val;
            break;
          // 'retry' and unknown fields are intentionally ignored
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
