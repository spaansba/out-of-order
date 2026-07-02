# @out-of-order/vitest

> ⚠️ **Under heavy development.** Released, but the API is still changing and may break between versions.

`toHaveValidTabOrder()` matcher for [Vitest Browser Mode](https://vitest.dev/guide/browser/). Runs the [`@out-of-order/core`](../core) analyzer against a real Chromium DOM, so a passing assertion reflects what users actually experience.

## Install

```bash
pnpm add -D @out-of-order/vitest
```

## Configure

`vitest.config.ts` (Vitest 4):

```ts
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
```

`test/setup.ts`:

```ts
import "@out-of-order/vitest"; // registers the matcher + types
```

## Use

```ts
import { expect, test } from "vitest";

test("dialog tab order is valid", () => {
  document.body.innerHTML = `
    <button>Cancel</button>
    <button>Confirm</button>
  `;
  expect(document.body).toHaveValidTabOrder();
});
```

Pass options to scope the rules:

```ts
expect(form).toHaveValidTabOrder({
  rules: { "missing-accessible-name": "off" },
});
```

Testing a real component? Mount it and assert on the returned container, not `document.body`:

```ts
import { render } from "vitest-browser-vue";
import SignupForm from "./SignupForm.vue";

test("signup form tab order", () => {
  const { container } = render(SignupForm);
  expect(container).toHaveValidTabOrder();
});
```

The target can be an `Element` or `Document`. On failure the message lists every violation with its rule id and tab position.

> Why Browser Mode and not jsdom? The checks need CSS layout (visibility and visual position). jsdom has no layout engine, so it can't tell you whether the order is correct in a real browser. This matcher only runs where layout is real.
