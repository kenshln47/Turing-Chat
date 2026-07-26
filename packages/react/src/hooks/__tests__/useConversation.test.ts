/**
 * Tests for conversation persistence.
 *
 * The chat previously never wrote messages into a thread at all: the sidebar
 * listed threads, but selecting one changed nothing and a reload lost
 * everything. These tests pin down the behaviour that fixed it.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInMemoryMemory } from '@turing-chat/core';
import type { ConversationMemory, Message } from '@turing-chat/core';
import { useConversation } from '../useConversation';

/** Builds a message. */
function msg(role: Message['role'], content: string, id = `${role}-${content}`): Message {
  return { id, role, content, timestamp: Date.now() };
}

/**
 * Renders the hook and waits for its initial thread load to settle.
 *
 * Without this, the load resolving mid-test produces an unwrapped state
 * update and React's act() warning.
 */
async function renderConversation(memory: ConversationMemory) {
  const rendered = renderHook(() => useConversation(memory));
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return rendered;
}

describe('useConversation persistence', () => {
  it('creates a thread on the first save', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'hello')]);
    });

    const stored = await memory.getAllThreads();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.messages).toHaveLength(1);
  });

  it('writes nothing when there are no messages', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      const saved = await result.current.saveMessages([]);
      expect(saved).toBeNull();
    });

    expect(await memory.getAllThreads()).toHaveLength(0);
  });

  it('titles the thread from the first user message', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([
        msg('system', 'you are helpful'),
        msg('user', 'How do I reverse a linked list?'),
        msg('assistant', 'Walk the list…'),
      ]);
    });

    const [thread] = await memory.getAllThreads();
    expect(thread!.title).toBe('How do I reverse a linked list?');
  });

  it('truncates a very long title', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'x'.repeat(200))]);
    });

    const [thread] = await memory.getAllThreads();
    expect(thread!.title.length).toBeLessThanOrEqual(61);
    expect(thread!.title.endsWith('…')).toBe(true);
  });

  it('collapses whitespace when deriving a title', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', '  hello\n\n   world  ')]);
    });

    const [thread] = await memory.getAllThreads();
    expect(thread!.title).toBe('hello world');
  });

  it('keeps appending to the same thread across saves', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'first')]);
    });
    await act(async () => {
      await result.current.saveMessages([msg('user', 'first'), msg('assistant', 'reply')]);
    });

    const stored = await memory.getAllThreads();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.messages).toHaveLength(2);
  });

  it('does not overwrite a manually chosen title', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'original question')]);
    });

    const [created] = await memory.getAllThreads();
    await act(async () => {
      await result.current.renameThread(created!.id, 'My custom name');
    });
    await act(async () => {
      await result.current.saveMessages([
        msg('user', 'original question'),
        msg('assistant', 'answer'),
      ]);
    });

    const [thread] = await memory.getAllThreads();
    expect(thread!.title).toBe('My custom name');
  });

  it('starts a fresh thread after startNewThread', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'first chat')]);
    });
    act(() => {
      result.current.startNewThread();
    });
    await act(async () => {
      await result.current.saveMessages([msg('user', 'second chat')]);
    });

    const stored = await memory.getAllThreads();
    expect(stored).toHaveLength(2);
    expect(stored.map((t) => t.title).sort()).toEqual(['first chat', 'second chat']);
  });

  it('persists nothing when a new conversation is abandoned before sending', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    act(() => {
      result.current.startNewThread();
    });

    // No empty "New Conversation" left behind.
    expect(await memory.getAllThreads()).toHaveLength(0);
  });

  it('returns the thread with its messages when switching', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'thread one'), msg('assistant', 'a')]);
    });
    const [saved] = await memory.getAllThreads();

    act(() => {
      result.current.startNewThread();
    });

    let loaded: Awaited<ReturnType<typeof result.current.switchThread>> = null;
    await act(async () => {
      loaded = await result.current.switchThread(saved!.id);
    });

    expect(loaded).not.toBeNull();
    expect(loaded!.messages.map((m) => m.content)).toEqual(['thread one', 'a']);
  });

  it('loads previously stored threads on mount', async () => {
    const memory = createInMemoryMemory();
    await memory.saveThread({
      id: 't1',
      title: 'Earlier session',
      messages: [msg('user', 'from last time')],
      createdAt: 1,
      updatedAt: 1,
    });

    const { result } = await renderConversation(memory);

    await waitFor(() => expect(result.current.threads).toHaveLength(1));
    expect(result.current.threads[0]!.title).toBe('Earlier session');
  });

  it('clears the active thread when it is deleted', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'doomed')]);
    });
    const [saved] = await memory.getAllThreads();

    await act(async () => {
      await result.current.deleteThread(saved!.id);
    });

    expect(result.current.activeThread).toBeNull();
    expect(await memory.getAllThreads()).toHaveLength(0);
  });

  it('moves the most recently saved thread to the top of the list', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'older')]);
    });
    act(() => {
      result.current.startNewThread();
    });
    await act(async () => {
      await result.current.saveMessages([msg('user', 'newer')]);
    });

    expect(result.current.threads[0]!.title).toBe('newer');
  });

  it('round-trips through export and import', async () => {
    const memory = createInMemoryMemory();
    const { result } = await renderConversation(memory);

    await act(async () => {
      await result.current.saveMessages([msg('user', 'keep me')]);
    });

    let json = '';
    await act(async () => {
      json = await result.current.exportThreads();
    });

    const target = createInMemoryMemory();
    const { result: restored } = await renderConversation(target);
    await act(async () => {
      await restored.current.importThreads(json);
    });

    await waitFor(() => expect(restored.current.threads).toHaveLength(1));
    expect(restored.current.threads[0]!.messages[0]!.content).toBe('keep me');
  });
});
