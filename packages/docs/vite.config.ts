import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { defineConfig, type Connect } from 'vite';
import react from '@vitejs/plugin-react';

// Vite treats .gz files as HTTP compression, which changes downloaded archives.
export function archiveDownloads(
  directory: string
): Connect.NextHandleFunction {
  return (request, response, next) => {
    const path = request.url?.split('?')[0] ?? '';
    if (
      !['GET', 'HEAD'].includes(request.method ?? '') ||
      !/^\/(?:commerce-example\/(?:(?:\d\d-[\w-]+\/)?source|ai-reproduction-source)|commerce-composition\/source)\.tar\.gz$/.test(
        path
      )
    ) {
      next();
      return;
    }
    let bytes: Buffer;
    try {
      bytes = readFileSync(join(directory, path.slice(1)));
    } catch (error) {
      next(error);
      return;
    }
    response.setHeader('Content-Type', 'application/gzip');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${basename(path)}"`
    );
    response.setHeader('Content-Length', bytes.length);
    response.end(request.method === 'HEAD' ? undefined : bytes);
  };
}

const ReactCompilerConfig = {
  target: '18',
};

export default defineConfig({
  plugins: [
    {
      name: 'commerce-source-downloads',
      configureServer({ middlewares, config }) {
        middlewares.use(archiveDownloads(config.publicDir));
      },
      configurePreviewServer({ middlewares, config }) {
        middlewares.use(
          archiveDownloads(join(config.root, config.build.outDir))
        );
      },
    },
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
          if (id.includes('/src/pages/commerce-protocol/')) {
            return 'commerce-protocol';
          }
        },
      },
    },
  },
});
