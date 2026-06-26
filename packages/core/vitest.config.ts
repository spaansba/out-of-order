import { defineConfig } from "vitest/config";

export default defineConfig({
  // position-observer (the overlay's dep) is pre-bundled so it isn't optimized
  // mid-run, which makes Vitest reload a test and warn about flakiness.
  optimizeDeps: { include: ["position-observer"] },
  test: {
    // The analyzer needs real CSS layout (tabbable + getBoundingClientRect), so
    // every test runs in a real browser rather than jsdom.
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      name: "chromium",
    },
  },
});
