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

## Releasing (Changesets)

Every pull request that changes a published package (`core`, `trace`, `cli`, `vitest`) **must include a changeset**.
From the repo root:

```bash
pnpm changeset
```

Select the package(s) you changed, pick a bump level (below), and write a short user-facing summary of the effect, not the implementation.

For changes that should not trigger a release (docs, tests, CI, internal refactors with no observable effect), add an empty changeset so it is clear you did not just forget one:

```bash
pnpm changeset --empty
```

### Bump levels

| Level     | When to use                                                     |
| --------- | --------------------------------------------------------------- |
| **patch** | Bug fix, no API change.                                         |
| **minor** | New export or new option, backward compatible.                  |
| **major** | Removed or renamed export, or changed behavior of existing API. |

Pick the level based on the impact on that package's public API, not on how large the code change was.

### What happens after you merge

1. Merging to `main` triggers the Release workflow.
2. Changesets opens (or updates) a **Version Packages** PR that applies the bumps and updates changelogs.
3. When a maintainer merges that PR, the changed packages publish to npm automatically.

## Reporting bugs

Open an issue with a minimal HTML snippet (or a URL) that reproduces the wrong verdict, what you expected, and what the analyzer reported. Reproductions that run through the demo or the `cli` are easiest to triage.
