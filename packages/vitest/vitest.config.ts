import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Register the matcher (and its types) before any test runs.
    setupFiles: ["./src/setup.ts"],
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      // Vitest 2.1.x browser API: single named browser.
      name: "chromium",
    },
  },
});
