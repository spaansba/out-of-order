import { resolve } from "node:path";
import { defineConfig } from "vite";

// Alias the workspace packages to their TypeScript source so the demo runs with
// `vite dev` without building them first.
export default defineConfig({
  // Served from a GitHub Pages project subpath (focuspocusjs.github.io/focuspocus/),
  // so assets must resolve under /focuspocus/, not /. Override with a build-time
  // BASE_PATH (e.g. "/" for a custom domain or local `vite preview`).
  base: process.env.BASE_PATH ?? "/focuspocus/",
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
        home: resolve(__dirname, "index.html"),
        violations: resolve(__dirname, "violations.html"),
        tabbable: resolve(__dirname, "tabbable.html"),
        start: resolve(__dirname, "getting-started.html"),
        concepts: resolve(__dirname, "concepts.html"),
        rules: resolve(__dirname, "rules.html"),
        api: resolve(__dirname, "api.html"),
        recipes: resolve(__dirname, "recipes.html"),
        faq: resolve(__dirname, "faq.html"),
      },
    },
  },
});
