/**
 * Regression tests for markdown rendering guarantees.
 *
 * These exist because the project's headline features were unverified: the
 * test setup stubbed `react-syntax-highlighter` with a plain-text component,
 * so no test could tell highlighting from no highlighting, and GFM tables fell
 * through as paragraphs because remark-gfm was never wired up.
 *
 * Every assertion below checks real rendered output rather than merely that
 * something appeared.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '@turing-chat/core';
import { MessageBubble, MAX_HIGHLIGHT_LENGTH } from '../MessageBubble';

/** Wraps markdown in an assistant message. */
function message(content: string): Message {
  return { id: 'm1', role: 'assistant', content, timestamp: 1_700_000_000_000 };
}

describe('syntax highlighting', () => {
  it('emits Prism token spans, not plain text', () => {
    const { container } = render(
      <MessageBubble message={message('```typescript\nconst x: number = 42;\n```')} />,
    );

    // The exact failure this guards: a code block that renders, looks fine,
    // and contains no tokens at all.
    expect(container.querySelectorAll('code span.token').length).toBeGreaterThan(0);
  });

  it('highlights every registered language', () => {
    const samples: Array<[string, string]> = [
      ['javascript', 'const a = 1;'],
      ['typescript', 'let b: string = "x";'],
      ['python', 'def f(): return 1'],
      ['bash', 'echo "hi"'],
      ['json', '{"a": 1}'],
      ['css', 'a { color: red; }'],
      ['sql', 'SELECT 1;'],
      ['rust', 'let x = 5;'],
      ['go', 'func main() {}'],
      ['yaml', 'key: value'],
      ['tsx', 'const A = () => <div />;'],
    ];

    for (const [language, code] of samples) {
      const { container } = render(
        <MessageBubble message={message(`\`\`\`${language}\n${code}\n\`\`\``)} />,
      );
      expect(
        container.querySelectorAll('code span.token').length,
        `expected ${language} to be tokenised`,
      ).toBeGreaterThan(0);
    }
  });

  it('labels the block with its fence language', () => {
    const { container } = render(
      <MessageBubble message={message('```python\nprint(1)\n```')} />,
    );
    expect(container.querySelector('.tac-code-language')?.textContent).toBe('python');
  });

  it('renders an unlabelled fence without a language tag', () => {
    const { container } = render(<MessageBubble message={message('```\nplain\n```')} />);
    expect(container.querySelector('.tac-code-language')?.textContent).toBe('');
    expect(container.querySelector('[data-turing="code-block"]')).toBeTruthy();
  });

  it('preserves the exact source, including inner blank lines', () => {
    const { container } = render(
      <MessageBubble message={message('```js\nconst a = 1;\n\nconst b = 2;\n```')} />,
    );
    const text = container.querySelector('[data-turing="code-block"] code')?.textContent;
    expect(text).toBe('const a = 1;\n\nconst b = 2;');
  });

  it('falls back to plain text beyond the highlight threshold', () => {
    const huge = 'const x = 1;\n'.repeat(Math.ceil(MAX_HIGHLIGHT_LENGTH / 13) + 100);
    const { container } = render(
      <MessageBubble message={message(`\`\`\`javascript\n${huge}\`\`\``)} />,
    );

    const block = container.querySelector('[data-turing="code-block"]');
    expect(block).toBeTruthy();
    // Readable and copyable, but never tokenised — tokenising this would block
    // the main thread for seconds.
    expect(block!.querySelectorAll('span.token').length).toBe(0);
    expect(block!.querySelector('code')?.textContent).toContain('const x = 1;');
    expect(container.querySelector('[data-turing="copy-code-btn"]')).toBeTruthy();
  });

  it('still highlights a block just under the threshold', () => {
    const code = 'const x = 1;\n'.repeat(100);
    const { container } = render(
      <MessageBubble message={message(`\`\`\`javascript\n${code}\`\`\``)} />,
    );
    expect(container.querySelectorAll('code span.token').length).toBeGreaterThan(0);
  });
});

describe('GFM support', () => {
  it('renders pipe tables as real table elements', () => {
    const { container } = render(
      <MessageBubble
        message={message('| Model | Speed |\n|---|---|\n| alpha | fast |\n| beta | slow |')}
      />,
    );

    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelector('th')?.textContent).toBe('Model');
  });

  it('lets a wide table scroll inside its own container', () => {
    const { container } = render(
      <MessageBubble message={message('| a | b |\n|---|---|\n| 1 | 2 |')} />,
    );
    const scroller = container.querySelector('[data-turing="table-scroll"]');
    expect(scroller).toBeTruthy();
    expect(scroller).toHaveStyle({ overflowX: 'auto' });
  });

  it('renders strikethrough', () => {
    const { container } = render(<MessageBubble message={message('~~gone~~')} />);
    expect(container.querySelector('del')?.textContent).toBe('gone');
  });

  it('renders task lists as disabled checkboxes', () => {
    const { container } = render(
      <MessageBubble message={message('- [x] done\n- [ ] todo')} />,
    );

    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    expect((boxes[1] as HTMLInputElement).checked).toBe(false);
    // A transcript is not a form.
    expect([...boxes].every((b) => (b as HTMLInputElement).disabled)).toBe(true);
  });

  it('autolinks bare URLs', () => {
    const { container } = render(
      <MessageBubble message={message('See https://example.com for details.')} />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('renders blockquotes and horizontal rules', () => {
    const { container } = render(<MessageBubble message={message('> quoted\n\n---')} />);
    expect(container.querySelector('blockquote')?.textContent).toContain('quoted');
    expect(container.querySelector('hr')).toBeTruthy();
  });
});

describe('message chrome', () => {
  it('keeps the copy button outside the bubble so it cannot cover the text', () => {
    const { container } = render(<MessageBubble message={message('hello there')} />);

    const bubble = container.querySelector('[data-turing="bubble"]');
    const copyBtn = container.querySelector('[data-turing="copy-btn"]');

    expect(bubble).toBeTruthy();
    expect(copyBtn).toBeTruthy();
    // It used to be absolutely positioned inside the bubble, sitting on top of
    // the first line of every message.
    expect(bubble!.contains(copyBtn!)).toBe(false);
  });

  it('offers no copy button for an empty message', () => {
    const { container } = render(<MessageBubble message={message('')} />);
    expect(container.querySelector('[data-turing="copy-btn"]')).toBeNull();
  });

  it('renders the timestamp and copy control on one row', () => {
    const { container } = render(<MessageBubble message={message('hi')} />);
    const time = container.querySelector('time');
    const copyBtn = container.querySelector('[data-turing="copy-btn"]');

    expect(time).toBeTruthy();
    expect(time!.parentElement).toBe(copyBtn!.parentElement);
  });

  it('uses no emoji as iconography', () => {
    const { container } = render(
      <MessageBubble
        message={{
          id: 'm1',
          role: 'assistant',
          content: 'calling a tool',
          timestamp: 0,
          toolCalls: [{ id: 't1', name: 'calculator', arguments: { a: 1 } }],
        }}
      />,
    );

    // Emoji render differently per operating system and ignore the theme.
    expect(container.textContent).not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{25A0}-\u{25FF}]/u,
    );
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});

describe('mixed content', () => {
  it('renders prose, a table and a highlighted block in one message', () => {
    const { container } = render(
      <MessageBubble
        message={message(
          '# Title\n\nSome **bold** text.\n\n' +
            '| a | b |\n|---|---|\n| 1 | 2 |\n\n' +
            '```python\nprint("hi")\n```\n\n' +
            'Trailing ~~struck~~ text.',
        )}
      />,
    );

    expect(container.querySelector('h1')?.textContent).toBe('Title');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelectorAll('code span.token').length).toBeGreaterThan(0);
    expect(container.querySelector('del')?.textContent).toBe('struck');
  });

  it('gives each code block its own independent copy button', () => {
    const { container } = render(
      <MessageBubble message={message('```js\na\n```\ntext\n```py\nb\n```')} />,
    );
    expect(container.querySelectorAll('[data-turing="copy-code-btn"]')).toHaveLength(2);
  });
});
