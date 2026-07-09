---
"@out-of-order/core": patch
---

`missing-accessible-name` now flags an unlabeled `contenteditable` editing host. A bare `<div contenteditable>` is a real editable textbox and a tab stop, but `isInteractive` only knew native controls and interactive ARIA roles, so every interactive-gated rule skipped it (adding `role="textbox"` made the same box flag). `isInteractive` now recognizes the editing host, keyed on the `contenteditable` attribute rather than the inherited `.isContentEditable` property so descendants of an editable region aren't each counted as a control.
