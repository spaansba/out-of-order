import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@focuspocus/core",
        replacement: resolve(__dirname, "../core/src/index.ts"),
      },
    ],
  },
  // position-observer (the tracker's dep) is pre-bundled so it isn't optimized
  // mid-run, which makes Vitest reload a test and warn about flakiness.
  optimizeDeps: { include: ["position-observer"] },
  test: {
    // The overlay reads real CSS layout (tabbable + getBoundingClientRect), so
    // every test runs in a real browser rather than jsdom.
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      name: "chromium",
    },
  },
});
