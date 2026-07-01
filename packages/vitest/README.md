# @out-of-order/vitest

`toHaveValidTabOrder()` matcher for [Vitest Browser Mode](https://vitest.dev/guide/browser/). Runs the [`@out-of-order/core`](../core) analyzer against a real Chromium DOM, so a passing assertion reflects what users actually experience.

## Install

```bash
pnpm add -D @out-of-order/vitest vitest @vitest/browser playwright
```

## Configure

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    browser: {
      enabled: true,
      provider: "playwright",
      headless: true,
      name: "chromium",
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
  rules: { "missing-accessible-name": false },
});
```

The target can be an `Element`, `Document`, or `DocumentFragment`. On failure the message lists every violation with its rule id and tab position.

> Why Browser Mode and not jsdom? The checks need CSS layout (visibility and visual position). jsdom has no layout engine, so it can't tell you whether the order is correct in a real browser. This matcher only runs where layout is real.
