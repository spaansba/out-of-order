import { configDefaults, defineWorkspace } from "vitest/config";

// The matcher's real behavior is checked in Chromium (it needs CSS layout). The
// jsdom, happy-dom, and node projects only exist to prove the environment guard
// fires when layout is unavailable.
export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "chromium",
      exclude: [...configDefaults.exclude, "src/**/*.{jsdom,happy-dom,node}.test.ts"],
    },
  },
  {
    test: {
      name: "jsdom",
      environment: "jsdom",
      setupFiles: ["./src/setup.ts"],
      include: ["src/**/*.jsdom.test.ts"],
    },
  },
  {
    test: {
      name: "happy-dom",
      environment: "happy-dom",
      setupFiles: ["./src/setup.ts"],
      include: ["src/**/*.happy-dom.test.ts"],
    },
  },
  {
    test: {
      name: "node",
      environment: "node",
      setupFiles: ["./src/setup.ts"],
      include: ["src/**/*.node.test.ts"],
    },
  },
]);
