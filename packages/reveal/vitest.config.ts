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
  optimizeDeps: { include: ["position-observer"] },
  test: {
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      name: "chromium",
    },
  },
});
