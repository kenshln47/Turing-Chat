/**
 * End-to-end behaviour of the assembled chat component.
 *
 * Covers the two structural bugs that made the component unusable in practice:
 * compare mode overwrote the second model's answer with the first model's, and
 * conversations were never written to storage at all.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createInMemoryMemory, mockProvider } from '@turing-chat/core';
import type { ConversationMemory } from '@turing-chat/core';
import { TuringChat } from '../TuringChat';

/** Instant provider so tests never wait on simulated latency. */
const provider = mockProvider({ speedFactor: 0 });

/** Types into the composer and submits. */
async function send(text: string) {
  const user = userEvent.setup();
  const input = screen.getByRole('textbox');
  await user.click(input);
  await user.paste(text);
  await user.keyboard('{Enter}');
}

/** Renders the chat with the mock provider and an isolated memory. */
function renderChat(props: Partial<Parameters<typeof TuringChat>[0]> = {}, memory?: ConversationMemory) {
  return render(
    <TuringChat
      provider={provider}
      model="mock-swift:3b"
      memory={memory ?? createInMemoryMemory()}
      showThreadList
      {...props}
    />,
  );
}

/** The transcript pane, excluding the thread sidebar. */
function messageList(): HTMLElement {
  return screen.getByLabelText('Chat messages');
}

describe('conversation flow', () => {
  it('streams an assistant reply after sending', async () => {
    renderChat();
    await send('hello there');

    await waitFor(() => {
      expect(messageList().textContent).toContain('hello there');
    });
    await waitFor(() => {
      const assistant = messageList().querySelectorAll('[data-role="assistant"]');
      expect(assistant.length).toBeGreaterThan(0);
      expect(assistant[0]!.textContent!.length).toBeGreaterThan(10);
    });
  });
});

describe('persistence', () => {
  it('writes the exchange to storage', async () => {
    const memory = createInMemoryMemory();
    renderChat({}, memory);

    await send('remember this');

    await waitFor(async () => {
      const threads = await memory.getAllThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0]!.messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('titles the stored thread from the first message', async () => {
    const memory = createInMemoryMemory();
    renderChat({}, memory);

    await send('what is a monad');

    await waitFor(async () => {
      const [thread] = await memory.getAllThreads();
      expect(thread?.title).toBe('what is a monad');
    });
  });

  it('restores the previous conversation on remount', async () => {
    const memory = createInMemoryMemory();
    const first = renderChat({}, memory);

    await send('survive the reload');
    await waitFor(async () => {
      expect(await memory.getAllThreads()).toHaveLength(1);
    });

    // Simulate a page refresh: tear down and mount fresh against the same store.
    first.unmount();
    renderChat({}, memory);

    // The message must come back in the transcript itself, not just as a
    // title in the sidebar.
    await waitFor(() => {
      expect(messageList().textContent).toContain('survive the reload');
    });
    expect(messageList().querySelectorAll('[data-role="assistant"]').length).toBeGreaterThan(0);
  });

  it('shows the saved thread in the sidebar', async () => {
    const memory = createInMemoryMemory();
    renderChat({}, memory);

    await send('sidebar entry');

    await waitFor(() => {
      // The thread carries a delete control labelled with its title, which is
      // unique to the sidebar.
      expect(screen.getByLabelText('Delete thread: sidebar entry')).toBeInTheDocument();
    });
  });
});

describe('compare mode', () => {
  it('keeps each column on its own model, without one overwriting the other', async () => {
    renderChat({
      model: 'mock-swift:3b',
      compareModel: 'mock-sage:14b',
      defaultCompareMode: true,
    });

    await send('compare the two');

    const columnA = await screen.findByLabelText('Chat messages model A');
    const columnB = await screen.findByLabelText('Chat messages model B');

    // Both models answer.
    await waitFor(() => {
      expect(
        columnA.querySelectorAll('[data-role="assistant"]').length,
      ).toBeGreaterThan(0);
      expect(
        columnB.querySelectorAll('[data-role="assistant"]').length,
      ).toBeGreaterThan(0);
    });

    const textOf = (col: HTMLElement) =>
      [...col.querySelectorAll('[data-role="assistant"]')]
        .map((n) => n.textContent ?? '')
        .join('');

    // The regression: after streaming settled, column B was replaced by a copy
    // of column A. Their answers must stay distinct.
    await waitFor(() => {
      const a = textOf(columnA);
      const b = textOf(columnB);
      expect(a.length).toBeGreaterThan(10);
      expect(b.length).toBeGreaterThan(10);
      expect(a).not.toBe(b);
    });

    // And they must still differ once everything has settled.
    await new Promise((r) => setTimeout(r, 50));
    expect(textOf(columnA)).not.toBe(textOf(columnB));
  });

  it('seeds the comparison column with the conversation so far when enabled', async () => {
    const user = userEvent.setup();
    renderChat({ model: 'mock-swift:3b', compareModel: 'mock-sage:14b' });

    await send('first question');
    await waitFor(() => {
      expect(document.querySelectorAll('[data-role="assistant"]').length).toBeGreaterThan(0);
    });

    await user.click(screen.getByTitle('Compare side-by-side'));

    const columnB = await screen.findByLabelText('Chat messages model B');
    // Column B starts from the same history rather than an empty pane.
    await waitFor(() => {
      expect(columnB.textContent).toContain('first question');
    });
  });
});
