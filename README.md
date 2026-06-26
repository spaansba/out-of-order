# focuspocus

Focus and keyboard-accessibility validation that runs in **real browsers only**. No jsdom, no layout guessing, no silently-skipped checks.

Built on [`tabbable`](https://github.com/focus-trap/tabbable) for the focus sequence, with a rules layer on top that decides whether that sequence is _valid_: correct order, every stop reachable, visible, and announced.

## Why real-browser only?

`tabbable` (and any honest focus check) needs CSS layout to know what's actually visible and where it sits visually. jsdom has no layout engine, so a green jsdom test can't promise the order is correct in a real browser. This project deliberately runs every assertion in real Chromium (via Vitest Browser Mode), so a passing test reflects reality.

## Packages

| Package                                   | What it is                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@focuspocus/core`](./packages/core)     | Pure analyzer (`@focuspocus/core`) **plus** a framework-agnostic live overlay (`@focuspocus/core/overlay`). Wraps `tabbable`, applies rules, returns a plain result and/or draws the numbered tab path. |
| [`@focuspocus/vitest`](./packages/vitest) | `expect(el).toHaveValidTabOrder()` matcher for Vitest Browser Mode, plus TypeScript augmentation.                                                                                                       |
| [`@focuspocus/demo`](./packages/demo)     | Vite demo — an edge-cases page and a deliberately-broken page, both thin consumers of the core overlay.                                                                                                 |

A Playwright matcher shares the same core and can be added later.

## Demo

```bash
pnpm install
pnpm --filter @focuspocus/demo dev
```

Two pages: a tabbable edge-case gauntlet, and one where focus and keyboard access are clearly broken. Both just call `mountOverlay()` from the library.

## Quick start

```bash
pnpm install
pnpm --filter @focuspocus/core build    # build core first (workspace types)
pnpm --filter @focuspocus/vitest test   # runs in headless Chromium
```

```ts
import { expect, test } from "vitest";
import "@focuspocus/vitest";

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

Rules across ordering, reachability, accessible naming, and ARIA/focus-management, each grounded in a WCAG, WAI-ARIA, or HTML-spec link and individually toggleable. See the [full table in `@focuspocus/core`](./packages/core#rules).
