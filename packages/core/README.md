# @focuspocus/core

Pure focus & keyboard-accessibility analyzer. Wraps [`tabbable`](https://github.com/focus-trap/tabbable) for the focus sequence and applies a rules layer to decide whether that sequence is _valid_: correct order, every stop reachable, visible, and announced. No test-runner or framework deps, just the DOM.

> Runs in a real browser only. It reads CSS layout (visibility + bounding rects), which jsdom does not provide.

```ts
import { analyzeTabOrder, formatViolations } from "@focuspocus/core";

const result = analyzeTabOrder(document.body);
// result.valid      -> boolean (true when there are no `error`-severity violations)
// result.sequence   -> elements in tab order, with tabIndex + rect
// result.violations -> [{ rule, severity, message, element, selector, orderIndex }]

if (!result.valid) console.log(formatViolations(result.violations));
```

## API

`analyzeTabOrder(root = document, options?) => TabOrderResult`

Each rule carries a default severity (see the table below). `error` marks a real barrier (a control is unreachable, unannounced, invisible, or trapped); `warning` marks dead/no-op markup or a best-practice nit that doesn't block anyone. Only an `error` makes `result.valid` false, so warnings won't fail a build gate.

```ts
type Severity = "error" | "warning";
type RuleSetting = Severity | "off";

interface AnalyzeOptions {
  // Per-rule overrides. Omit a rule to keep its default; otherwise:
  //   "error" | "warning" -> enable, graded at that severity
  //   "off"               -> disable the rule
  rules?: Partial<Record<RuleId, RuleSetting>>;
}

// e.g. demote a noisy rule, promote another, and turn one off:
analyzeTabOrder(document.body, {
  rules: {
    "visual-order-mismatch": "warning",
    "redundant-tabindex": "error",
    "prefer-native-element": "off",
  },
});
```

The built-in defaults are exported as `DEFAULT_SEVERITY` (a `Record<RuleId, Severity>`).

## Rules

All rules are on by default. "Severity" is the default grade, overridable per `AnalyzeOptions.rules`.

| Rule                         | Severity | Needs layout? | What it catches                                                    |
| ---------------------------- | -------- | ------------- | ------------------------------------------------------------------ |
| `no-positive-tabindex`       | error    | no            | `tabindex > 0`, which hijacks natural order                        |
| `visual-order-mismatch`      | warning  | **yes**       | tab order that doesn't follow top→bottom, left→right reading order |
| `missing-accessible-name`    | error    | no            | focusable interactive elements with no accessible name             |
| `aria-hidden-focusable`      | error    | no            | tabbable element inside `aria-hidden="true"`                       |
| `hidden-while-focusable`     | error    | **yes**       | tabbable but invisible (opacity:0, zero size, off-screen, clipped) |
| `clickable-not-focusable`    | error    | **yes**       | mouse-only control (role/onclick) the keyboard can't reach         |
| `composite-roving-tabindex`  | warning  | no            | composite widget (toolbar, tablist, …) with one tab stop per item  |
| `focus-escapes-modal`        | error    | no            | background controls still tabbable while a modal is open           |
| `tabindex-on-noninteractive` | error    | **yes**       | `tabindex="0"` on a role-less, non-interactive element             |
| `prefer-native-element`      | warning  | no            | generic tag reimplementing a native control via an interactive role |
| `duplicate-autofocus`        | warning  | **yes**       | more than one focusable `autofocus` element (only the first ever wins) |
| `autofocus-not-focusable`    | warning  | **yes**       | `autofocus` on a non-focusable element (a no-op on load)           |
| `nested-interactive`         | error    | no            | a focusable control nested inside another focusable element        |
| `redundant-tabindex`         | warning  | no            | `tabindex="0"` on an already-focusable native control (a no-op)    |

Adding a rule is just a pure function `(sequence, ctx) => Finding[]` (a `Finding` is a `Violation` minus `severity`, which `analyzeTabOrder` stamps on from `DEFAULT_SEVERITY` or the caller's override); see `src/rules.ts`.

## Live overlay

The visual overlay (a numbered path through the tab sequence, every finding ringed in place, details on hover) lives in its own package, [`@focuspocus/reveal`](../reveal), built on this analyzer. Keeping it separate is deliberate: `analyzeTabOrder` stays dependency-light apart from `tabbable`, so the core export remains easy to run inside `page.evaluate` (e.g. for a Playwright adapter).
