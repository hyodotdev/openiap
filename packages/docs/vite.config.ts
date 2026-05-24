import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ReactCompilerConfig = {
  target: '18',
};

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', ReactCompilerConfig],
          ['module:@preact/signals-react-transform'],
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) {
              return 'vendor-react-dom';
            }
            if (id.includes('react-router')) {
              return 'vendor-react-router';
            }
            if (id.includes('react-icons')) {
              return 'vendor-react-icons';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
          }
          if (id.includes('/src/pages/docs/updates/')) {
            return 'docs-updates';
          }
          if (id.includes('/src/pages/docs/apis/')) {
            return 'docs-apis';
          }
          if (id.includes('/src/pages/docs/types/')) {
            return 'docs-types';
          }
          if (id.includes('/src/pages/docs/features/')) {
            return 'docs-features';
          }
          if (id.includes('/src/pages/docs/setup/')) {
            return 'docs-setup';
          }
          if (id.includes('/src/pages/docs/guides/')) {
            return 'docs-guides';
          }
          if (id.includes('/src/pages/docs/foundation/')) {
            return 'docs-foundation';
          }
        },
      },
    },
  },
});
