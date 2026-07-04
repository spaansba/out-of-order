import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@out-of-order/core",
        replacement: resolve(__dirname, "../core/src/index.ts"),
      },
    ],
  },
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
