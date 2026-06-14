import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

vi.mock('react-syntax-highlighter', () => {
  const MockHighlighter = ({ children, language, PreTag = 'pre', CodeTag = 'code', style, customStyle, ...props }: any) => {
    return React.createElement(
      PreTag,
      { style: customStyle, ...props },
      React.createElement(
        CodeTag,
        { className: language ? `language-${language}` : undefined },
        children
      )
    );
  };
  (MockHighlighter as any).registerLanguage = vi.fn();

  return {
    Prism: MockHighlighter,
    PrismLight: MockHighlighter,
    Light: MockHighlighter,
    default: MockHighlighter,
  };
});



