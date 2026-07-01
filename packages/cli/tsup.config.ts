import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      inject: "src/inject.ts",
      "inject-overlay": "src/inject-overlay.ts",
    },
    format: "iife",
    platform: "browser",
    outDir: "dist",
    clean: true,
  },
  {
    entry: { cli: "src/cli.ts" },
    format: "esm",
    platform: "node",
    target: "node18",
    outDir: "dist",
  },
]);
