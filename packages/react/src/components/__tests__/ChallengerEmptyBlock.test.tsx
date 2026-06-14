import { render } from '@testing-library/react';
import { describe, it } from 'vitest';
import { MessageBubble } from '../MessageBubble';
import type { Message } from '@turing-chat/core';

const createMockMessage = (content: string): Message => ({
  id: 'test-msg-id',
  role: 'assistant',
  content,
  timestamp: 1625097600000,
});

describe('Inspect DOM structure', () => {
  it('prints the HTML structure of code block', () => {
    const msg = createMockMessage('```html\n<div><script>alert(1)</script></div>\n```');
    const { container } = render(<MessageBubble message={msg} />);
    const codeBlock = container.querySelector('[data-turing="code-block"]');
    console.log('--- Full code block HTML structure:');
    console.log(codeBlock?.outerHTML);
  });
});
