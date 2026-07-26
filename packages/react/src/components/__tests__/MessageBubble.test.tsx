import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBubble } from '../MessageBubble';
import type { Message } from '@turing-chat/core';

// Helper to construct a message object
const createMockMessage = (content: string, role: 'user' | 'assistant' | 'system' = 'assistant'): Message => ({
  id: 'test-msg-id',
  role,
  content,
  timestamp: 1625097600000, // 2021-07-01T00:00:00Z
});

// Setup clipboard mocks
const writeTextMock = vi.fn().mockImplementation(() => Promise.resolve());
const execCommandMock = vi.fn().mockImplementation(() => true);

beforeEach(() => {
  vi.useFakeTimers();
  writeTextMock.mockClear();
  execCommandMock.mockClear();

  // Mock navigator.clipboard
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: writeTextMock,
    },
    writable: true,
    configurable: true,
  });

  // Mock document.execCommand
  document.execCommand = execCommandMock;
});

afterEach(() => {
  vi.useRealTimers();
});

// ────────────────────────────────────────────────────────────────────────────
// Tier 1 - Feature Coverage (15 test cases: 5 Markdown, 5 Syntax, 5 Copy)
// ────────────────────────────────────────────────────────────────────────────
describe('Tier 1 - Feature Coverage', () => {
  describe('Markdown Rendering', () => {
    it('renders plain text correctly without formatting', () => {
      const msg = createMockMessage('Hello world');
      render(<MessageBubble message={msg} />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders bold text wrapped in strong tag', () => {
      const msg = createMockMessage('This is **bold** text');
      render(<MessageBubble message={msg} />);
      const boldEl = screen.getByText('bold');
      expect(boldEl.tagName).toBe('STRONG');
    });

    it('renders italic text wrapped in em tag', () => {
      const msg = createMockMessage('This is *italic* text');
      render(<MessageBubble message={msg} />);
      const italicEl = screen.getByText('italic');
      expect(italicEl.tagName).toBe('EM');
    });

    it('renders inline code wrapped in code tag', () => {
      const msg = createMockMessage('This is `code` segment');
      render(<MessageBubble message={msg} />);
      const codeEl = screen.getByText('code');
      expect(codeEl.tagName).toBe('CODE');
    });

    it('renders multiple consecutive inline elements correctly', () => {
      const msg = createMockMessage('**bold** and *italic* and `code` in one line');
      render(<MessageBubble message={msg} />);
      expect(screen.getByText('bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText('code').tagName).toBe('CODE');
    });
  });

  describe('Syntax Highlighting', () => {
    it('renders a basic code block with pre tag', () => {
      const msg = createMockMessage('```\nconst a = 1;\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const codeBlock = container.querySelector('[data-turing="code-block"]');
      expect(codeBlock).toBeInTheDocument();
      expect(codeBlock?.querySelector('pre')).toBeInTheDocument();
    });

    it('parses and displays the language tag in the code block header', () => {
      const msg = createMockMessage('```typescript\nconst a = 1;\n```');
      render(<MessageBubble message={msg} />);
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('renders the code block content inside pre and code tags', () => {
      const msg = createMockMessage('```javascript\nconsole.log(42);\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const codeBlock = container.querySelector('[data-turing="code-block"]');
      expect(codeBlock).toBeInTheDocument();
      const pre = codeBlock?.querySelector('pre');
      expect(pre).toBeInTheDocument();
      const code = pre?.querySelector('code');
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toContain('console.log(42);');
    });

    it('applies appropriate styling attributes or classes to the code block for syntax highlighting', () => {
      const msg = createMockMessage('```javascript\nconst x = 5;\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const codeBlock = container.querySelector('[data-turing="code-block"]');
      expect(codeBlock).toBeInTheDocument();
      const pre = codeBlock?.querySelector('pre');
      expect(pre).toHaveStyle({ fontFamily: 'var(--tur-font-mono)' });
    });

    it('renders code blocks without a language tag specified', () => {
      const msg = createMockMessage('```\nplain code block\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const header = container.querySelector('.tac-code-header');
      expect(header).toBeInTheDocument();
      const languageSpan = container.querySelector('.tac-code-language');
      expect(languageSpan?.textContent).toBe('');
      const copyBtn = header?.querySelector('button');
      expect(copyBtn).toBeInTheDocument();
      const codeContent = container.querySelector('[data-turing="code-block"] pre code')?.textContent;
      expect(codeContent).toContain('plain code block');
    });
  });

  describe('Copy Code Button', () => {
    it('displays the copy button when message content is present', () => {
      const msg = createMockMessage('Some message content');
      render(<MessageBubble message={msg} />);
      const btn = screen.getByRole('button', { name: /copy/i });
      expect(btn).toBeInTheDocument();
    });

    it('triggers clipboard writeText when the copy button is clicked', async () => {
      const msg = createMockMessage('Some message content');
      render(<MessageBubble message={msg} />);
      const btn = screen.getByRole('button', { name: /copy/i });
      await fireEvent.click(btn);
      expect(writeTextMock).toHaveBeenCalledWith('Some message content');
    });

    it('changes button text or aria-label to indicate successful copying', async () => {
      const msg = createMockMessage('Some message content');
      render(<MessageBubble message={msg} />);
      const btn = screen.getByRole('button', { name: /copy/i });
      await fireEvent.click(btn);
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
    });

    it('reverts the copy button status back to normal after a delay', async () => {
      const msg = createMockMessage('Some message content');
      render(<MessageBubble message={msg} />);
      const btn = screen.getByRole('button', { name: /copy/i });
      await fireEvent.click(btn);
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });

    it('does not render copy button if the message content is empty', () => {
      const msg = createMockMessage('');
      render(<MessageBubble message={msg} />);
      const btn = screen.queryByRole('button');
      expect(btn).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tier 2 - Boundary & Corner Cases (15 test cases: 5 Markdown, 5 Syntax, 5 Copy)
// ────────────────────────────────────────────────────────────────────────────
describe('Tier 2 - Boundary & Corner Cases', () => {
  describe('Markdown Rendering', () => {
    it('renders text with unmatched markdown bold symbols gracefully', () => {
      const msg = createMockMessage('This is **bold text without match');
      render(<MessageBubble message={msg} />);
      expect(screen.getByText(/This is \*\*bold text/)).toBeInTheDocument();
    });

    it('handles empty bold and empty italic markers without crashing', () => {
      const msg = createMockMessage('Empty markers **** and **');
      const { container } = render(<MessageBubble message={msg} />);
      expect(container).toBeInTheDocument();
      expect(screen.getByText(/Empty markers/)).toBeInTheDocument();
    });

    it('renders multi-line markdown paragraphs with line breaks', () => {
      const msg = createMockMessage('Line 1\nLine 2\nLine 3');
      const { container } = render(<MessageBubble message={msg} />);
      expect(container.querySelectorAll('br').length).toBe(2);
      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    });

    it('handles HTML special characters inside markdown text without escaping issues', () => {
      const msg = createMockMessage('Inside markdown: <div> & <span />');
      render(<MessageBubble message={msg} />);
      expect(screen.getByText('Inside markdown: <div> & <span />')).toBeInTheDocument();
    });

    it('handles nested formatting or adjacent formatting markers like bold italic', () => {
      const msg = createMockMessage('***bold italic***');
      render(<MessageBubble message={msg} />);
      const textEl = screen.getByText('bold italic');
      expect(textEl).toBeInTheDocument();
    });
  });

  describe('Syntax Highlighting', () => {
    it('renders empty code block correctly', () => {
      const msg = createMockMessage('```javascript\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const codeBlock = container.querySelector('[data-turing="code-block"]');
      expect(codeBlock).toBeInTheDocument();
    });

    it('handles code block with leading or trailing blank lines', () => {
      const msg = createMockMessage('```\n\nconst x = 1;\n\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const codeContent = container.querySelector('[data-turing="code-block"] pre code')?.textContent;
      expect(codeContent).toContain('\nconst x = 1;\n');
    });

    it('renders code block containing markdown-like syntax inside it as literal text', () => {
      const msg = createMockMessage('```markdown\nThis is **not bold** inside code\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const codeContent = container.querySelector('[data-turing="code-block"] pre code')?.textContent;
      // The asterisks survive verbatim — the markdown parser did not consume them.
      expect(codeContent).toContain('This is **not bold** inside code');
      // Prism may style the run as a markdown bold *token*, but it must never
      // become a real <strong>: that would mean the fence leaked into the
      // markdown renderer.
      expect(container.querySelector('strong')).not.toBeInTheDocument();
    });

    it('handles language tags with special characters or numbers like c++ or react-jsx', () => {
      const msg = createMockMessage('```c++\nint x = 0;\n```');
      render(<MessageBubble message={msg} />);
      expect(screen.getByText('c++')).toBeInTheDocument();
    });

    it('renders extremely large/long code blocks without truncation or errors', () => {
      const code = 'console.log("hello");\n'.repeat(500);
      const msg = createMockMessage('```js\n' + code + '```');
      const { container } = render(<MessageBubble message={msg} />);
      const pre = container.querySelector('[data-turing="code-block"] pre');
      expect(pre).toBeInTheDocument();
      expect(pre?.textContent).toContain('console.log("hello");');
    });
  });

  describe('Copy Code Button', () => {
    it('copies correct text when code block has multiple lines and whitespace', async () => {
      const content = 'line 1\n  line 2\n\nline 3';
      const msg = createMockMessage(content);
      render(<MessageBubble message={msg} />);
      const btn = screen.getByRole('button', { name: /copy/i });
      await fireEvent.click(btn);
      expect(writeTextMock).toHaveBeenCalledWith(content);
    });

    it('falls back to legacy copy methods if navigator.clipboard is unavailable', async () => {
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const msg = createMockMessage('fallback copy content');
      render(<MessageBubble message={msg} />);
      const btn = screen.getByRole('button', { name: /copy/i });
      await fireEvent.click(btn);

      expect(execCommandMock).toHaveBeenCalledWith('copy');
      
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it('handles clipboard API rejection gracefully without throwing uncaught errors', async () => {
      writeTextMock.mockRejectedValueOnce(new Error('Clipboard access denied'));
      const msg = createMockMessage('error copy content');
      render(<MessageBubble message={msg} />);
      const btn = screen.getByRole('button', { name: /copy/i });
      
      expect(() => fireEvent.click(btn)).not.toThrow();
    });

    it('handles rapid consecutive copy button clicks correctly', async () => {
      const msg = createMockMessage('consecutive clicks');
      render(<MessageBubble message={msg} />);
      const btn = screen.getByRole('button', { name: /copy/i });
      
      await fireEvent.click(btn);
      await fireEvent.click(btn);
      await fireEvent.click(btn);
      
      expect(writeTextMock).toHaveBeenCalledTimes(3);
    });

    it('positions/displays copy button correctly based on user vs assistant role alignment', () => {
      const assistantMsg = createMockMessage('assistant msg', 'assistant');
      const { container: assistantContainer } = render(<MessageBubble message={assistantMsg} />);
      const assistantBubble = assistantContainer.querySelector('[data-turing="message"]');
      expect(assistantBubble).toHaveStyle({ alignSelf: 'flex-start' });

      const userMsg = createMockMessage('user msg', 'user');
      const { container: userContainer } = render(<MessageBubble message={userMsg} />);
      const userBubble = userContainer.querySelector('[data-turing="message"]');
      expect(userBubble).toHaveStyle({ alignSelf: 'flex-end' });
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tier 3 - Cross-Feature Interactions (3 test cases)
// ────────────────────────────────────────────────────────────────────────────
describe('Tier 3 - Cross-Feature Interactions', () => {
  it('prevents rendering of markdown formatting inside a syntax-highlighted code block', () => {
    const msg = createMockMessage('```js\nconst bold = **value**;\n```');
    const { container } = render(<MessageBubble message={msg} />);
    const codeBlock = container.querySelector('[data-turing="code-block"]');
    expect(codeBlock).toBeInTheDocument();
    const pre = codeBlock?.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.querySelector('strong')).not.toBeInTheDocument();
    expect(pre?.textContent).toContain('const bold = **value**;');
  });

  it('copies the raw markdown source content rather than the rendered HTML representation', async () => {
    const content = 'This is **bold** text with `code`.';
    const msg = createMockMessage(content);
    render(<MessageBubble message={msg} />);
    const btn = screen.getByRole('button', { name: /copy/i });
    await fireEvent.click(btn);
    expect(writeTextMock).toHaveBeenCalledWith(content);
  });

  it('ensures streaming state does not interfere with copying or syntax highlighting of already received content', () => {
    const msg = createMockMessage('```js\nconst a = 1;\n```\nExplanation...');
    const { container } = render(<MessageBubble message={msg} isStreaming={true} />);
    
    expect(screen.getByText('js')).toBeInTheDocument();
    expect(screen.getByText('Explanation...')).toBeInTheDocument();
    expect(container.querySelector('[data-turing="copy-btn"]')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tier 4 - Real-World Application Scenarios (5 test cases)
// ────────────────────────────────────────────────────────────────────────────
describe('Tier 4 - Real-World Application Scenarios', () => {
  it('handles a complex assistant response with text explanation, python code block, and list summary', () => {
    const content = `Here is the explanation.
\`\`\`python
def greet(name):
    print("Hello, " + name)
\`\`\`
Follow these guidelines:
* Keep it simple
* Document everything`;
    const msg = createMockMessage(content);
    render(<MessageBubble message={msg} />);
    
    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByText('Here is the explanation.')).toBeInTheDocument();
    expect(screen.getByText(/Keep it simple/)).toBeInTheDocument();
  });

  it('renders system message instructions using markdown and inline code with appropriate styling', () => {
    const msg = createMockMessage('Always set your `API_KEY` in **production** environment.', 'system');
    render(<MessageBubble message={msg} />);
    
    expect(screen.getByText('API_KEY').tagName).toBe('CODE');
    expect(screen.getByText('production').tagName).toBe('STRONG');
  });

  it('handles active streaming of code blocks and dynamically updates copy button eligibility', () => {
    const { container, rerender } = render(
      <MessageBubble message={createMockMessage('```python\ndef ', 'assistant')} isStreaming={true} />
    );
    
    expect(screen.getByText('python')).toBeInTheDocument();
    
    rerender(
      <MessageBubble message={createMockMessage('```python\ndef greet():\n    pass\n```', 'assistant')} isStreaming={false} />
    );
    
    const pre = container.querySelector('[data-turing="code-block"] pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain('def greet():');
  });

  it('renders mixed markdown tables, bullet points, and code blocks simulating typical LLM outputs', () => {
    const content = `| Feature | Support |
| --- | --- |
| Markdown | Yes |

* bullet 1
* bullet 2

\`\`\`bash
npm install @turing-chat/react
\`\`\``;
    const msg = createMockMessage(content);
    const { container } = render(<MessageBubble message={msg} />);
    
    expect(screen.getByText('bash')).toBeInTheDocument();
    const codeBlock = container.querySelector('[data-turing="code-block"] pre code');
    expect(codeBlock?.textContent).toContain('npm install');
    expect(screen.getByText(/bullet 1/)).toBeInTheDocument();
  });

  it('handles malformed code block segments and partial markdown syntax gracefully in error/fallback state', () => {
    const content = `Unfinished code block:
\`\`\`js
const unfinished = true;
// missing closing backticks
Some other text.`;
    const msg = createMockMessage(content);
    const { container } = render(<MessageBubble message={msg} />);
    
    expect(container).toBeInTheDocument();
    expect(screen.getByText(/Unfinished code block/)).toBeInTheDocument();
  });

  describe('CodeBlock Copy Functionality (New Unit Tests)', () => {
    it('verifies that the copy code button is rendered in the header of code blocks', () => {
      const msg = createMockMessage('```typescript\nconst code = 123;\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const header = container.querySelector('.tac-code-header');
      expect(header).toBeInTheDocument();
      const copyBtn = container.querySelector('[data-turing="copy-code-btn"]');
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn?.textContent).toContain('Copy');
    });

    it('verifies that clicking the copy code button writes only the code block\'s content to the clipboard', async () => {
      const codeText = 'const code = 123;';
      const msg = createMockMessage(`\`\`\`typescript\n${codeText}\n\`\`\``);
      const { container } = render(<MessageBubble message={msg} />);
      const copyBtn = container.querySelector('[data-turing="copy-code-btn"]');
      expect(copyBtn).toBeInTheDocument();
      
      await fireEvent.click(copyBtn!);
      expect(writeTextMock).toHaveBeenCalledWith(codeText);
    });

    it('verifies that the copy button state changes to success ("Copied!") and reverts after 2 seconds', async () => {
      const msg = createMockMessage('```typescript\nconst code = 123;\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const copyBtn = container.querySelector('[data-turing="copy-code-btn"]');
      expect(copyBtn).toBeInTheDocument();
      
      await fireEvent.click(copyBtn!);
      expect(copyBtn?.textContent).toContain('Copied!');
      
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(copyBtn?.textContent).toContain('Copy');
    });

    it('verifies that copying is isolated when a message contains multiple code blocks (clicking one does not affect the others)', async () => {
      const msg = createMockMessage('```python\nprint(1)\n```\nSome text\n```javascript\nconsole.log(2)\n```');
      const { container } = render(<MessageBubble message={msg} />);
      const copyBtns = container.querySelectorAll('[data-turing="copy-code-btn"]');
      expect(copyBtns.length).toBe(2);
      
      const [btn1, btn2] = Array.from(copyBtns);
      expect(btn1.textContent).toContain('Copy');
      expect(btn2.textContent).toContain('Copy');
      
      await fireEvent.click(btn1);
      expect(btn1.textContent).toContain('Copied!');
      expect(btn2.textContent).toContain('Copy');
      
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(btn1.textContent).toContain('Copy');
      expect(btn2.textContent).toContain('Copy');
    });
  });
});
