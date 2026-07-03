# @out-of-order/cli

> ⚠️ **Under heavy development.** Released, but the API is still changing and may break between versions.

Audit any URL's tab order from the command line. It drives real Chromium (via [Playwright](https://playwright.dev/)), runs the [`@out-of-order/core`](../core) analyzer against the live page, and prints the findings to stdout. Pipe them into an AI agent or gate a CI job on the exit code.

## Use

```bash
npx @out-of-order/cli <url> [options]
```

Playwright's Chromium must be present (once per machine):

```bash
npx playwright install chromium
```

`<url>` also accepts a bare domain (`https://` is assumed, `http://` for localhost) or a path to a local HTML file.

```bash
# text report to stdout, exits non-zero if the page has errors
npx @out-of-order/cli https://example.com

# open a headed browser with the live overlay
npx @out-of-order/cli https://example.com --overlay

# machine-readable output, grouped per element
npx @out-of-order/cli https://example.com --format by-element

# the full result as JSON: valid, the tab sequence, and the violations
npx @out-of-order/cli https://example.com --format json

# disable a rule and treat another as an error
npx @out-of-order/cli https://example.com --rule redundant-tabindex=off --rule visual-order-mismatch=error

# wait for a selector before auditing a JS-heavy page
npx @out-of-order/cli https://example.com --wait "main [role=dialog]"

# audit the mobile layout
npx @out-of-order/cli https://example.com --viewport 390x844
```

Auditing your own app on every change? Use the [`@out-of-order/vitest`](../vitest) matcher in your test suite instead. The CLI is for pages you don't have a test harness around: a deployed site, a staging URL, someone else's page.

## Pages behind a login

Only needed when the page is gated behind a login (Playwright's [authentication docs](https://playwright.dev/docs/auth) explain the mechanism). Log in once, by hand, in a real browser:

```bash
npx @out-of-order/cli login https://app.example.com
```

Sign in (MFA, SSO, captchas all work since it's you in the browser), then press Ctrl-C in the terminal. The session is saved to a per-host file under `~/.config/out-of-order/auth/`, and every later audit of that host picks it up automatically:

```bash
npx @out-of-order/cli https://app.example.com/settings
```

When the session expires, run `login` again. For CI, save to an explicit file and pass it along:

```bash
npx @out-of-order/cli login https://app.example.com --auth ./auth.json
npx @out-of-order/cli https://app.example.com/settings --auth ./auth.json
```

The file is a Playwright [storage state](https://playwright.dev/docs/auth): it contains live session cookies, so treat it like a credential (inject it as a CI secret, don't commit it).

## Options

| Option              | What it does                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--format <name>`   | Output shape: `text` (default), `by-element`, `by-violation`, `flat`, or `json` (the full result: valid, tab sequence, violations). |
| `--rule <id>=<lvl>` | Set a rule to `off`, `error`, or `warning`. Repeatable. Also applies to the overlay.                                                |
| `--auth <file>`     | Storage-state file to save (`login`) or load (audit). Default: a per-host file under `~/.config/out-of-order/auth/`.                |
| `--wait <selector>` | Wait for a selector before auditing (JS-heavy pages).                                                                               |
| `--tries <n>`       | Re-audit up to `n` times, 1s apart, while the page has no tabbable elements (default: 5).                                           |
| `--timeout <ms>`    | Navigation and selector timeout (default: 30000).                                                                                   |
| `--viewport <WxH>`  | Viewport size, e.g. `1440x900`.                                                                                                     |
| `--overlay`         | Open a headed browser with the visual overlay instead of printing.                                                                  |
| `--version`         | Print the version.                                                                                                                  |
| `--help`            | Show usage.                                                                                                                         |

## Exit codes

| Code | Meaning                                                                      |
| ---- | ---------------------------------------------------------------------------- |
| `0`  | Audited, no errors (warnings do not fail the audit).                         |
| `1`  | Audited, errors found.                                                       |
| `2`  | Bad arguments, the page failed to load, or the browser could not be started. |

Because it exits `1` on any error, dropping `npx @out-of-order/cli <url>` into a CI step fails the build on a broken tab order.
