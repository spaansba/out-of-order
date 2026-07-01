# Out of Order

> ⚠️ **Heavy development.** Released, but the API is still changing and may break between versions.

Focus and keyboard-accessibility validation that runs in **real browsers only**. No jsdom, no layout guessing, no silently-skipped checks.

Built on [`tabbable`](https://github.com/focus-trap/tabbable) for the focus sequence, with a rules layer on top that decides whether that sequence is _valid_: correct order, every stop reachable, visible, and announced.

## Why real-browser only?

`tabbable` (and any honest focus check) needs CSS layout to know what's actually visible and where it sits visually. jsdom has no layout engine, so a green jsdom test can't promise the order is correct in a real browser. This project deliberately runs every assertion in real Chromium (via Vitest Browser Mode), so a passing test reflects reality.

## Packages

| Package                                     | What it is                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@out-of-order/core`](./packages/core)     | Pure analyzer. Wraps `tabbable`, applies rules, returns a plain result. No framework or test-runner deps, just the DOM.                          |
| [`@out-of-order/trace`](./packages/trace)   | Framework-agnostic live overlay built on the core analyzer: numbers the tab path, rings every finding in place, shows per-stop details on hover. |
| [`@out-of-order/vitest`](./packages/vitest) | `expect(el).toHaveValidTabOrder()` matcher for Vitest Browser Mode, plus TypeScript augmentation.                                                |
| [`@out-of-order/demo`](./packages/demo)     | Vite demo — an edge-cases page and a deliberately-broken page, both thin consumers of `@out-of-order/trace`.                                     |

A Playwright matcher shares the same core and can be added later.

## Demo & docs

The [`@out-of-order/demo`](./packages/demo) package is the project site: docs pages (getting started, concepts, the rule reference, the API, recipes, FAQ) plus two interactive demos, a tabbable edge-case gauntlet and a page where focus and keyboard access are clearly broken. Both demos just call `trace()` from the library.

```bash
pnpm install
pnpm --filter @out-of-order/demo dev
```

It deploys to GitHub Pages on every push to `main` (see [`.github/workflows/deploy-demo.yml`](./.github/workflows/deploy-demo.yml)), served at `https://spaansba.github.io/out-of-order/`.

## Quick start

```bash
pnpm install
pnpm --filter @out-of-order/core build    # build core first (workspace types)
pnpm --filter @out-of-order/vitest test   # runs in headless Chromium
```

```ts
import { expect, test } from "vitest";
import "@out-of-order/vitest";

test("modal has a sane tab order", () => {
  document.body.innerHTML = `
    <button>First</button>
    <a href="#">Second</a>
    <input aria-label="Search" />
  `;
  expect(document.body).toHaveValidTabOrder();
});
```

## Rules

Rules across ordering, reachability, accessible naming, and ARIA/focus-management, each grounded in a WCAG, WAI-ARIA, or HTML-spec link and individually toggleable. See the [full table in `@out-of-order/core`](./packages/core#rules).
