import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    content: "src/content.ts",
    "service-worker": "src/service-worker.ts",
    panel: "src/panel.ts",
  },
  format: "iife",
  platform: "browser",
  outDir: "dist",
  clean: true,
  publicDir: "public",
  outExtension: () => ({ js: ".js" }),
  onSuccess: "node scripts/sync-manifest-version.mjs",
});
