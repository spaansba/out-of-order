import { resolve } from "node:path";
import { defineConfig } from "vite";

// Alias the workspace packages to their TypeScript source so the demo runs with
// `vite dev` without building them first.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@focuspocus/reveal",
        replacement: resolve(__dirname, "../reveal/src/index.ts"),
      },
      {
        find: "@focuspocus/core",
        replacement: resolve(__dirname, "../core/src/index.ts"),
      },
    ],
  },
  // Never pre-bundle the workspace package; keep it as live source so edits to
  // ../core/src hot-update instead of being cached in node_modules/.vite.
  optimizeDeps: {
    exclude: ["@focuspocus/core", "@focuspocus/reveal"],
  },
  server: {
    fs: {
      // Allow serving files from the monorepo root (the sibling core package).
      allow: [resolve(__dirname, "../..")],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        tabbable: resolve(__dirname, "tabbable.html"),
      },
    },
  },
});
