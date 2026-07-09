---
"@out-of-order/core": patch
---

`aria-hidden-focusable` now normalizes the `aria-hidden` value before matching, so `aria-hidden="TRUE"` and `aria-hidden=" true "` are treated as hidden. `inAriaHidden` previously did an exact `=== "true"` check, letting uppercase or whitespace-padded values slip through unflagged.
