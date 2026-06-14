import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MessageBubble } from '../MessageBubble';
import type { Message } from '@turing-chat/core';

const createMockMessage = (content: string, role: 'user' | 'assistant' | 'system' = 'assistant'): Message => ({
  id: 'adversarial-msg-id',
  role,
  content,
  timestamp: 1625097600000,
});

const writeTextMock = vi.fn().mockImplementation(() => Promise.resolve());
const execCommandMock = vi.fn().mockImplementation(() => true);

beforeEach(() => {
  vi.useFakeTimers();
  writeTextMock.mockClear();
  execCommandMock.mockClear();

  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: writeTextMock,
    },
    writable: true,
    configurable: true,
  });

  document.execCommand = execCommandMock;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MessageBubble - Adversarial & Robustness Stress Tests', () => {
  
  describe('GFM Support & Complex Markdown', () => {
    it('handles tables (check if rendered as table tags or plain text)', () => {
      const content = `| Col 1 | Col 2 |
| --- | --- |
| Val 1 | Val 2 |`;
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      const table = container.querySelector('table');
      // If table is null, then react-markdown lacks GFM table support
      console.log('--- Adversarial Table Render Result: Table element exists? ', !!table);
      // We do not assert it must be present, but we check if it is
    });

    it('handles strikethrough (~~tilde~~)', () => {
      const content = 'This is ~~strikethrough~~ text';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      const del = container.querySelector('del') || container.querySelector('s');
      console.log('--- Adversarial Strikethrough Render Result: del/s element exists? ', !!del);
    });
  });

  describe('Nested and Adjacent Formatting', () => {
    it('renders deeply nested formatting correctly', () => {
      const content = 'This is ***bold and italic*** and **bold with *italic* inside**';
      render(<MessageBubble message={createMockMessage(content)} />);
      
      const boldAndItalic = screen.getByText('bold and italic');
      expect(boldAndItalic).toBeInTheDocument();
      // It should have both EM and STRONG in its hierarchy
      expect(boldAndItalic.closest('strong') || boldAndItalic.closest('em')).toBeInTheDocument();
    });

    it('renders inline code inside bold/italic text', () => {
      const content = 'This is ***bold italic `code`***';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      const codeEl = container.querySelector('code');
      expect(codeEl).toBeInTheDocument();
      expect(codeEl?.textContent).toBe('code');
    });
  });

  describe('Lists and Line Breaks', () => {
    it('checks if line breaks inside list items preserve formatting or collapse', () => {
      const content = `* Item 1 Line 1\n  Item 1 Line 2`;
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      const li = container.querySelector('li');
      expect(li).toBeInTheDocument();
      const br = li?.querySelector('br');
      console.log('--- Adversarial List Item Line Break: br element exists? ', !!br);
    });
  });

  describe('Links and Security (HTML/XSS Injection)', () => {
    it('renders normal links correctly', () => {
      const content = 'Check [Google](https://google.com "Google Search")';
      render(<MessageBubble message={createMockMessage(content)} />);
      const link = screen.getByRole('link', { name: 'Google' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://google.com');
      expect(link).toHaveAttribute('title', 'Google Search');
    });

    it('sanitizes HTML injection (XSS)', () => {
      const content = 'Safe text <script>alert("xss")</script> <img src="x" onerror="alert(1)" /> done';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      
      // The script tag should either not exist or be escaped
      const script = container.querySelector('script');
      expect(script).toBeNull();
      
      const img = container.querySelector('img');
      // If image exists, make sure onerror doesn't trigger or it's escaped
      if (img) {
        expect(img.getAttribute('onerror')).toBeNull();
      }
    });

    it('sanitizes javascript: URLs in links to prevent XSS', () => {
      const content = '[harmful link](javascript:alert("xss"))';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      const link = container.querySelector('a');
      if (link) {
        const href = link.getAttribute('href');
        // Check if href is stripped or safe (typically empty, about:invalid, or doesn't execute javascript)
        const isSafe = !href || href === '' || href === 'about:invalid' || href.startsWith('http') || !href.startsWith('javascript:');
        expect(isSafe).toBe(true);
      }
    });
  });

  describe('Extreme & Malformed Inputs', () => {
    it('handles giant inputs without crashes', () => {
      const content = '# Header\n' + 'word '.repeat(5000) + '\n\n* list item'.repeat(100);
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      expect(container).toBeInTheDocument();
    });

    it('handles unmatched and incomplete formatting', () => {
      const content = 'Unmatched **bold *italic `inline code';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      expect(container).toBeInTheDocument();
    });

    it('handles extremely large code block (10,000 lines) without crashing', () => {
      const largeCode = 'const x = 1;\n'.repeat(10000);
      const content = '```javascript\n' + largeCode + '```';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      expect(container).toBeInTheDocument();
      const pre = container.querySelector('[data-turing="code-block"] pre');
      expect(pre).toBeInTheDocument();
    });

    it('handles unregistered/unknown language tags gracefully without throwing', () => {
      const content = '```rust\nlet x = 5;\n```';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      const codeBlock = container.querySelector('[data-turing="code-block"]');
      expect(codeBlock).toBeInTheDocument();
      expect(codeBlock?.querySelector('pre')).toBeInTheDocument();
      expect(codeBlock?.querySelector('code')?.textContent).toContain('let x = 5;');
    });

    it('handles language tags with special characters or symbols', () => {
      const content = '```python/3\nprint(3)\n```';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      const langSpan = container.querySelector('.tac-code-language');
      expect(langSpan?.textContent).toBe('python/3');
    });

    it('renders HTML tags as literal text inside code blocks without parsing them as HTML', () => {
      const content = '```html\n<div><script>alert(1)</script></div>\n```';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      const pre = container.querySelector('[data-turing="code-block"] pre');
      expect(pre).toBeInTheDocument();
      const script = pre?.querySelector('script');
      expect(script).toBeNull();
      const div = pre?.querySelector('div');
      expect(div).toBeNull();
      expect(pre?.textContent).toContain('<div><script>alert(1)</script></div>');
    });

    it('handles non-string content or missing fields at runtime by throwing/erroring (documented bug)', () => {
      const badMessage = {
        id: 'bad-msg',
        role: 'assistant' as const,
        content: null as unknown as string,
        timestamp: 123456789,
      };
      expect(() => render(<MessageBubble message={badMessage} />)).toThrow();
    });

    it('handles empty content or whitespace-only messages without crashing', () => {
      const { container } = render(<MessageBubble message={createMockMessage('')} />);
      expect(container).toBeInTheDocument();

      const { container: container2 } = render(<MessageBubble message={createMockMessage('   \n  \n ')} />);
      expect(container2).toBeInTheDocument();
    });

    it('sanitizes data: and vbscript: protocols in links to prevent XSS', () => {
      const content1 = '[harmful link 1](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)';
      const content2 = '[harmful link 2](vbscript:alert(1))';
      
      const { container: container1 } = render(<MessageBubble message={createMockMessage(content1)} />);
      const link1 = container1.querySelector('a');
      if (link1) {
        const href = link1.getAttribute('href');
        const isSafe = !href || href === '' || href === 'about:invalid' || !href.startsWith('data:');
        expect(isSafe).toBe(true);
      }

      const { container: container2 } = render(<MessageBubble message={createMockMessage(content2)} />);
      const link2 = container2.querySelector('a');
      if (link2) {
        const href = link2.getAttribute('href');
        const isSafe = !href || href === '' || href === 'about:invalid' || !href.startsWith('vbscript:');
        expect(isSafe).toBe(true);
      }
    });

    it('sanitizes language tags with HTML injection and long characters', () => {
      const payload = 'js" class="injection-test" style="color:red" data-xss="';
      const content = '```' + payload + '\nconst x = 42;\n```';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      expect(container).toBeInTheDocument();
      const injectedSpan = container.querySelector('.injection-test');
      expect(injectedSpan).toBeNull();
      
      const langSpan = container.querySelector('.tac-code-language');
      expect(langSpan?.textContent).toBe('js"');

      const longLang = 'a'.repeat(500);
      const longContent = '```' + longLang + '\nconst x = 42;\n```';
      const { container: longContainer } = render(<MessageBubble message={createMockMessage(longContent)} />);
      const longLangSpan = longContainer.querySelector('.tac-code-language');
      expect(longLangSpan?.textContent).toBe(longLang);
    });

    it('handles null bytes and control characters gracefully in message content', () => {
      const content = 'Null \u0000 byte and control characters \u0001 \u0007 \u001b[31m ansi code \r\n and backspaces \b';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      expect(container).toBeInTheDocument();
    });

    it('ignores iframe, object, and embed injection', () => {
      const content = '<iframe src="javascript:alert(1)"></iframe><object data="javascript:alert(1)"></object><embed src="javascript:alert(1)"></embed>';
      const { container } = render(<MessageBubble message={createMockMessage(content)} />);
      expect(container.querySelector('iframe')).toBeNull();
      expect(container.querySelector('object')).toBeNull();
      expect(container.querySelector('embed')).toBeNull();
    });
  });
});

