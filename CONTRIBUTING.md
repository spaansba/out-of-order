# Contributing to Out of Order

Thanks for helping out!!

## Prerequisites

- **Node** 20 or newer
- **pnpm** 9.7 (the repo pins `packageManager`; `corepack enable` will pick it up)
- **Chromium** for the browser tests: `pnpm exec playwright install chromium`

## Layout

| Package                                     | What it is                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@out-of-order/core`](./packages/core)     | Pure analyzer. Wraps `tabbable`, applies rules, returns a plain result.              |
| [`@out-of-order/trace`](./packages/trace)   | Live visual overlay built on the core analyzer.                                      |
| [`@out-of-order/vitest`](./packages/vitest) | `toHaveValidTabOrder()` matcher for Vitest Browser Mode.                             |
| [`@out-of-order/cli`](./packages/cli)       | Audit any URL's tab order from the terminal.                                         |
| [`@out-of-order/demo`](./packages/demo)     | The Vite demo site (private, not published). Use this as PlayGround while developing |

Everything flows from `core`. `trace`, `vitest`, and `cli` are thin layers on top of `audit`, so most behavior changes start in `packages/core/src`.

## Setup

```bash
pnpm install
```

## Everyday commands

Run these from the repo root:

```bash
pnpm build        # build every package
pnpm test         # run the test suites (headless Chromium)
pnpm typecheck    # type-check every package
pnpm lint         # oxlint
pnpm format       # oxfmt
pnpm dev          # serve the demo site
```

## Tests run in a real browser

The suites use [Vitest Browser Mode](https://vitest.dev/guide/browser/) driving real Chromium through Playwright. This is deliberate: `tabbable` and the visibility rules need real layout, so a green jsdom test would not prove the tab order is correct on screen. Please keep new assertions inside Browser Mode rather than reaching for jsdom.

## Reporting bugs

Open an issue with a minimal HTML snippet (or a URL) that reproduces the wrong verdict, what you expected, and what the analyzer reported. Reproductions that run through the demo or the `cli` are easiest to triage.
