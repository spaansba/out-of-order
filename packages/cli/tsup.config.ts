import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { inject: "src/inject.ts" },
    format: "iife",
    globalName: "__ooo",
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
