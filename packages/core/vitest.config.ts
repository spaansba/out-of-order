import { defineConfig } from "vitest/config";

export default defineConfig({
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
