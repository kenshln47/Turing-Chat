/**
 * Type declarations for `react-syntax-highlighter`'s ESM subpath entries.
 *
 * The published `@types/react-syntax-highlighter` package only declares the
 * package root, so the per-language and per-theme ESM entries we import for
 * bundle size have no types of their own. These declarations supply them.
 */

declare module 'react-syntax-highlighter/dist/esm/prism-light' {
  import type { ComponentType } from 'react';
  import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';

  /** A Prism highlighter that only ships the languages you register. */
  interface PrismLightComponent extends ComponentType<SyntaxHighlighterProps> {
    /** Registers a language definition under the given name. */
    registerLanguage(name: string, language: unknown): void;
    /** Registers additional names for an already-registered language. */
    alias(name: string, aliases: string[]): void;
  }

  const PrismLight: PrismLightComponent;
  export default PrismLight;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/*' {
  /** An opaque refractor language definition. */
  const language: unknown;
  export default language;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism/*' {
  import type { CSSProperties } from 'react';

  /** A Prism theme, keyed by CSS selector. */
  const style: Record<string, CSSProperties>;
  export default style;
}
