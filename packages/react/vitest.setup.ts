import '@testing-library/jest-dom/vitest';

// NOTE: `react-syntax-highlighter` is deliberately NOT mocked.
//
// This file used to stub it with a component that rendered plain text. Every
// test still saw a code block, so the suite stayed green — while proving
// nothing about the project's headline feature. A regression that disabled
// highlighting entirely would have gone unnoticed.
//
// Highlighting is fast enough to run for real in tests, and
// MarkdownRendering.test.tsx asserts on actual Prism token output.
