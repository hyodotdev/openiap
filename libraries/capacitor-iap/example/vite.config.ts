import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

// The example runs the library from source.
export default defineConfig({
  resolve: {
    alias: {
      'capacitor-iap': fileURLToPath(
        new URL('../src/index.ts', import.meta.url),
      ),
    },
    dedupe: ['@capacitor/core'],
  },
  build: {outDir: 'dist', emptyOutDir: true},
});
