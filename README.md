# Out of Order

> ⚠️ **Under heavy development.** Released, but the API is still changing and may break between versions.

Focus & keyboard-accessibility validation for real browsers.

Out of Order works out the path the <kbd>Tab</kbd> key takes through a page, then checks that the order is right and that every stop is reachable, visible, and announced. It runs in real Chromium, because the answer depends on real layout.

**[Live site & docs](https://spaansba.github.io/out-of-order/)** · **[Playground](https://spaansba.github.io/out-of-order/playground.html)** (the bugs it catches) · **[What's tabbable](https://spaansba.github.io/out-of-order/tabbable.html)**

## Quick start

**See it** on a live page with the overlay:

```ts
import { trace } from "@out-of-order/trace";
trace(); // numbered tab stops, the path between them, findings ringed in place
```

**Check it** headless in a test or CI:

```ts
import { audit } from "@out-of-order/core";
const result = audit();
result.valid; // true when there are no error-severity violations
```

**Scan it** from the terminal, and pipe the findings into an AI agent:

```bash
npx playwright install chromium # once per machine

npx @out-of-order/cli https://example.com # prints findings
npx @out-of-order/cli https://example.com --overlay # opens a browser with the overlay
```

More in [getting started](https://spaansba.github.io/out-of-order/getting-started.html).

## Packages

| Package                                   | What it is                                                                                                   | Reach for it when                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`@out-of-order/core`](packages/core)     | The analyzer. Wraps `tabbable`, applies the rules, returns a plain result. No framework or test-runner deps. | You assert in a test or CI, or run headless in a Playwright `page.evaluate`.                    |
| [`@out-of-order/trace`](packages/trace)   | Framework-agnostic live overlay, built on core.                                                              | You want to see the tab path and findings on a live page. Most people want this.                |
| [`@out-of-order/cli`](packages/cli)       | Audits any URL from the terminal. Headless by default, `--overlay` to draw it live.                          | You check a URL without writing code, gate CI on the exit code, or pipe findings into an agent. |
| [`@out-of-order/vitest`](packages/vitest) | `toHaveValidTabOrder()` matcher for Vitest Browser Mode, built on core.                                      | You assert tab order inside a Vitest browser test.                                              |

## Docs

- [Getting started](https://spaansba.github.io/out-of-order/getting-started.html) — install, the three ways to run it, rule overrides, approving findings
- [Rules](https://spaansba.github.io/out-of-order/rules.html) — every rule, its severity, and the spec clause behind it
- [API reference](https://spaansba.github.io/out-of-order/api.html) — `audit()`, `trace()`, types, and custom rules

## Why real-browser only

An honest focus check needs CSS layout: what is really visible, what is clipped, where each control sits. `jsdom` has no layout engine, so a green `jsdom` test cannot promise the order holds up in a real browser. Out of Order reads live visibility and bounding rects, so a passing check reflects what a keyboard user will actually get.

## What it can't see

A check reads the page as it is the instant it runs. It sees the live DOM and its computed styles, including styles behind state selectors like `:focus`, but it never fires events or runs the page's own JavaScript. Anything that only exists at runtime is invisible to it: if a handler reveals a hidden element the moment it is tabbed to, the check sees only the resting state and can flag it as invisible even though a keyboard user would be fine. When that happens, drive the interaction yourself and run the check again on the state you actually get. A finding you have already weighed can be [approved in place](https://spaansba.github.io/out-of-order/getting-started.html#approve) with `data-ooo-ignore`.

Some checks read the page's stylesheet rules, and the browser's same-origin policy forbids reading the rules of a cross-origin stylesheet, so anything defined only there is invisible to the check.

A few things sit in the tab order in real browsers but are left out on purpose, because they cannot be reasoned about across browsers: an `<iframe>`, since its own document owns its stops, and a keyboard-focusable scroll container, since browsers disagree on it.

## License

[MIT](LICENSE)
