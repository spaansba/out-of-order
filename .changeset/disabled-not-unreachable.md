---
"@out-of-order/core": patch
---

`clickable-not-focusable` no longer flags disabled controls. A `<div role="button" aria-disabled="true">` is meant to be unfocusable, so leaving it out of the tab order is correct, not a keyboard-reachability gap. The rule read role/onclick but never checked `aria-disabled`, so it rang intentionally disabled controls and told you to make them keyboard-reachable. Added an `isAriaDisabled` helper (exported from the package root) and an early skip in the rule.
