import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Vite's SPA history fallback rewrites unmatched URLs to `/index.html`,
// which normally we want (React Router picks up deep links like
// `/docs/quickstart`). But for *static-document* extensions — `.txt`,
// `.xml`, `.json`, `.pdf`, `robots.txt`, `sitemap.xml`, `llms.txt`,
// etc. — a rewrite is wrong: a typo at `/llm.txt` gets served as the
// SPA shell, and React Router's `:orgSlug` route then matches the
// typo as a slug and shows "Organization not found". Bots and URL
// consumers expect a real 404.
//
// So: run BEFORE Vite's own handlers (pre-hook). Check the request
// path for a known static-document extension. If it matches and the
// file isn't in `public/`, return 404 immediately. Otherwise call
// `next()` and let Vite / the SPA handle it.
//
// The mirror guard for prod lives in `server/server.ts`.
function notFoundForMissingStaticDocs(): PluginOption {
  // Only intercept *root-level* static-document paths. By convention
  // these live directly at the site root (`/robots.txt`, `/sitemap.xml`,
  // `/llms.txt`, `/manifest.json`) — nested paths like
  // `/src/locales/en.json?import` belong to Vite's own transform
  // pipeline and must fall through untouched or the SPA won't even
  // load i18n bundles.
  const ROOT_STATIC_DOC =
    /^\/[a-z0-9._-]+\.(txt|xml|json|pdf|csv|yaml|yml|md|webmanifest)$/i;
  const publicDir = path.resolve(__dirname, "public");
  return {
    name: "openiap-kit:not-found-for-missing-static-docs",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const pathOnly = url.split("?")[0] ?? "";
        if (!ROOT_STATIC_DOC.test(pathOnly)) {
          next();
          return;
        }
        // `path.join` does NOT discard absolute segments (that's
        // `path.resolve`), so `path.join(publicDir, "/llms.txt")`
        // already produces `<publicDir>/llms.txt` correctly. Strip
        // the leading slash anyway to make the relative-segment
        // intent obvious — readers shouldn't have to recall the
        // exact difference between `join` and `resolve` to trust
        // this code.
        const onDisk = path.join(publicDir, pathOnly.replace(/^\/+/, ""));
        if (fs.existsSync(onDisk)) {
          next();
          return;
        }
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(`Not found: ${pathOnly}`);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), notFoundForMissingStaticDocs()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Forward `/v1/*` to the local Hono server (`bun run dev:server`,
  // listens on :3000). Without this proxy, hitting `/v1/...` from the
  // Vite dev host falls through to the SPA's React Router which has no
  // matching route and renders the 404 page — making it look like the
  // API endpoint doesn't exist when it actually does. The proxy lets
  // the dashboard host (5173) and the public API share one origin so
  // operators don't have to remember which port serves which surface.
  server: {
    proxy: {
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/mcp": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (!id.includes("node_modules")) return undefined;
          // Group React core, react-dom, react-router, antd, and
          // antd-adjacent rc-component libs into ONE vendor chunk.
          // Splitting React from its consumers (antd, react-router,
          // lucide-react) creates cross-chunk cycles that crash with
          // `Cannot set properties of undefined (setting 'Activity')`
          // when antd initializes before React's chunk finishes loading.
          if (
            /[\\/](react|react-dom|react-is|react-router(?:-dom)?|scheduler|use-sync-external-store|antd|@ant-design|@rc-component|rc-[^/\\]+|lucide-react|@preact[\\/]signals-(?:react|core))[\\/]/.test(
              id,
            )
          ) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
});
