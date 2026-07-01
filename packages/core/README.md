# @out-of-order/core

> ⚠️ **Under heavy development.** Released, but the API is still changing and may break between versions.

Pure focus & keyboard-accessibility analyzer. Wraps [`tabbable`](https://github.com/focus-trap/tabbable) for the focus sequence and applies a rules layer to decide whether that sequence is _valid_: correct order, every stop reachable, visible, and announced. No test-runner or framework deps, just the DOM.

> Runs in a real browser only. It reads CSS layout (visibility + bounding rects), which jsdom does not provide.

```ts
import { audit } from "@out-of-order/core";

console.log(audit(document.body, { format: "text" }).violations);
```

## API

`audit(root = document, options?) => AuditResult`

Each rule carries a default severity (see the table below), and can be changed or turned off completely.

```ts
// e.g. demote a noisy rule, promote another, and turn one off:
audit(document.body, {
  rules: {
    "visual-order-mismatch": "warning",
    "redundant-tabindex": "error",
    "prefer-native-element": "off",
  },
});
```

## Rules

All rules are on by default. "Severity" is the default grade, overridable per `AuditOptions.rules`.

| Rule                         | Severity | What it catches                                                        |
| ---------------------------- | -------- | ---------------------------------------------------------------------- |
| `no-positive-tabindex`       | error    | `tabindex > 0`, which hijacks natural order                            |
| `visual-order-mismatch`      | warning  | tab order that doesn't follow top→bottom, left→right reading order     |
| `missing-accessible-name`    | error    | focusable interactive elements with no accessible name                 |
| `aria-hidden-focusable`      | error    | tabbable element inside `aria-hidden="true"`                           |
| `hidden-while-focusable`     | error    | tabbable but invisible (opacity:0, zero size, off-screen, clipped)     |
| `clickable-not-focusable`    | error    | mouse-only control (role/onclick) the keyboard can't reach             |
| `composite-roving-tabindex`  | warning  | composite widget (toolbar, tablist, …) with one tab stop per item      |
| `focus-escapes-modal`        | error    | background controls still tabbable while a modal is open               |
| `tabindex-on-noninteractive` | error    | `tabindex="0"` on a role-less, non-interactive element                 |
| `prefer-native-element`      | warning  | generic tag reimplementing a native control via an interactive role    |
| `duplicate-autofocus`        | warning  | more than one focusable `autofocus` element (only the first ever wins) |
| `autofocus-not-focusable`    | warning  | `autofocus` on a non-focusable element (a no-op on load)               |
| `nested-interactive`         | error    | a focusable control nested inside another focusable element            |
| `redundant-tabindex`         | warning  | `tabindex="0"` on an already-focusable native control (a no-op)        |

Adding a rule is just a pure function `(sequence, ctx) => Finding[]` (a `Finding` is an `Issue` minus `severity`, which `audit` stamps on from the rule's default severity or the caller's override, then groups by element into `Violation`s); see `src/rules.ts`.

## Live overlay

The visual overlay (a numbered path through the tab sequence, every finding ringed in place, details on hover) lives in its own package, [`@out-of-order/trace`](../trace), built on this analyzer. Keeping it separate is deliberate: `audit` stays dependency-light apart from `tabbable`, so the core export remains easy to run inside `page.evaluate` (e.g. for a Playwright adapter).
