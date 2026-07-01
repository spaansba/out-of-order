import { configDefaults, defineWorkspace } from "vitest/config";

// Two projects: the matcher's real behavior is checked in Chromium (it needs
// CSS layout), while the jsdom project only exists to prove the environment
// guard fires when layout is unavailable.
export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "chromium",
      exclude: [...configDefaults.exclude, "test/**/*.jsdom.test.ts"],
    },
  },
  {
    test: {
      name: "jsdom",
      environment: "jsdom",
      setupFiles: ["./test/setup.ts"],
      include: ["test/**/*.jsdom.test.ts"],
    },
  },
]);
