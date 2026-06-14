import { defineConfig } from 'tsup';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  entry: ['src/index.ts', 'src/headless.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom', '@turing-chat/core', 'react-markdown', 'react-syntax-highlighter'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  onSuccess: async () => {
    // Copy CSS theme files to dist/themes
    const themesSource = resolve('src', 'themes');
    const themesDest = resolve('dist', 'themes');
    mkdirSync(themesDest, { recursive: true });
    cpSync(themesSource, themesDest, {
      recursive: true,
      filter: (src) => src.endsWith('.css') || !src.includes('.'),
    });
    console.log('✓ CSS themes copied to dist/themes');
  },
});
