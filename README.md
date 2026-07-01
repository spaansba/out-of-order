# Out of Order

> ⚠️ **Under heavy development.** Released, but the API is still changing and may break between versions.

Focus & keyboard-accessibility validation for real browsers.

Out of Order works out the exact path the <kbd>Tab</kbd> key takes through a page, then grades it: is the order right, and is every stop reachable, visible, and announced? It runs in real Chromium only, because that is the one place the answer is true. It builds on [tabbable](https://github.com/focus-trap/tabbable), with a rules layer on top.

**[Live site & docs](https://spaansba.github.io/out-of-order/)** · **[Playground](https://spaansba.github.io/out-of-order/playground.html)** (the bugs it catches) · **[What's tabbable](https://spaansba.github.io/out-of-order/tabbable.html)**

## Why real-browser only

An honest focus check needs CSS layout: what is really visible, what is clipped, where each control sits. `jsdom` has no layout engine, so a green `jsdom` test cannot promise the order holds up in a real browser. Out of Order reads live visibility and bounding rects, so a passing check reflects what a keyboard user actually gets. It stays light on dependencies, so it also runs inside a Playwright `page.evaluate`. See [concepts](https://spaansba.github.io/out-of-order/concepts.html).

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
result.valid; // false when there is an error-severity violation
```

**Scan it** from the terminal, or an AI agent:

```bash
npx @out-of-order/cli https://example.com           # prints findings, fails on violations
npx @out-of-order/cli https://example.com --overlay # opens a browser with the overlay
```

More in [getting started](https://spaansba.github.io/out-of-order/getting-started.html).

## Packages

| Package                                   | What it is                                                                                                   | Reach for it when                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [`@out-of-order/core`](packages/core)     | The analyzer. Wraps `tabbable`, applies the rules, returns a plain result. No framework or test-runner deps. | You assert in a test or CI, or run headless in a Playwright `page.evaluate`.                    |
| [`@out-of-order/trace`](packages/trace)   | Framework-agnostic live overlay, built on core, which it re-exports.                                         | You want to see the tab path and findings on a live page. Most people want this.                |
| [`@out-of-order/cli`](packages/cli)       | Audits any URL from the terminal. Headless by default, `--overlay` to draw it live.                          | You check a URL without writing code, gate CI on the exit code, or pipe findings into an agent. |
| [`@out-of-order/vitest`](packages/vitest) | `toHaveValidTabOrder()` matcher for Vitest Browser Mode. _In progress._                                      | You assert tab order inside a Vitest browser test.                                              |

## Docs

- [Getting started](https://spaansba.github.io/out-of-order/getting-started.html) — install, the three modes, rule overrides, approving findings
- [Concepts](https://spaansba.github.io/out-of-order/concepts.html) — how a tab order becomes a verdict, error vs warning, limitations
- [Rules](https://spaansba.github.io/out-of-order/rules.html) — every rule, its severity, and the spec clause behind it
- [API reference](https://spaansba.github.io/out-of-order/api.html) — `audit()`, `trace()`, types, and custom rules
- [Recipes](https://spaansba.github.io/out-of-order/recipes.html) — patterns for tests, CI, and Playwright

## Develop

```bash
pnpm install
pnpm dev        # run the demo site
pnpm build      # build all packages
pnpm test       # run tests
pnpm typecheck
```

## License

[MIT](LICENSE)
