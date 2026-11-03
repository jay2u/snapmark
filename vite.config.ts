import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import manifest from './manifest.config.ts';

const manifestPlugin = (): Plugin => ({
  name: 'emit-manifest',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(manifest, null, 2) });
  },
});

// Scripts that must keep a stable file name at the dist root.
const STABLE = ['background', 'selector', 'scroller'];

export default defineConfig({
  base: './',
  plugins: [manifestPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'src/popup/popup.html'),
        editor: resolve(import.meta.dirname, 'src/editor/editor.html'),
        history: resolve(import.meta.dirname, 'src/history/history.html'),
        desktop: resolve(import.meta.dirname, 'src/desktop/desktop.html'),
        background: resolve(import.meta.dirname, 'src/background/index.ts'),
        selector: resolve(import.meta.dirname, 'src/content/selector.ts'),
        scroller: resolve(import.meta.dirname, 'src/content/scroller.ts'),
      },
      output: {
        entryFileNames: (c) => (STABLE.includes(c.name) ? '[name].js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: { environment: 'node' },
});
