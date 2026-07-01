# @out-of-order/cli

> ⚠️ **Under heavy development.** Released, but the API is still changing and may break between versions.

Audit any URL's tab order from the command line. It drives real Chromium (via [Playwright](https://playwright.dev/)), runs the [`@out-of-order/core`](../core) analyzer against the live page, and prints the findings to stdout. Pipe them into an AI agent or gate a CI job on the exit code.

## Install

```bash
pnpm add -D @out-of-order/cli
# playwright browsers, if not already present:
pnpm exec playwright install chromium
```

## Use

```bash
out-of-order <url> [options]
```

```bash
# text report to stdout, exits non-zero if the page has violations
out-of-order https://example.com

# machine-readable output, grouped per element
out-of-order https://example.com --format by-element

# wait for a selector before auditing a JS-heavy page
out-of-order https://example.com --wait "main [role=dialog]"

# open a headed browser with the live overlay, Ctrl-C to quit
out-of-order https://example.com --overlay
```

## Options

| Option              | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| `--format <name>`   | Output shape: `text` (default) or `by-element`.                    |
| `--overlay`         | Open a headed browser with the visual overlay instead of printing. |
| `--wait <selector>` | Wait for a selector before auditing (JS-heavy pages).              |
| `--help`            | Show usage.                                                        |

## Exit codes

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| `0`  | Audited, tab order is valid.               |
| `1`  | Audited, violations found.                 |
| `2`  | Bad arguments, or the page failed to load. |

Because it exits `1` on any violation, dropping `out-of-order <url>` into a CI step fails the build on a broken tab order.
