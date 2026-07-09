# @out-of-order/core

## 0.3.2

### Patch Changes

- [#18](https://github.com/spaansba/out-of-order/pull/18) [`b3c0d5a`](https://github.com/spaansba/out-of-order/commit/b3c0d5af0a6f5f2e96bdec0d01087368e535f138) Thanks [@spaansba](https://github.com/spaansba)! - `aria-hidden-focusable` now normalizes the `aria-hidden` value before matching, so `aria-hidden="TRUE"` and `aria-hidden=" true "` are treated as hidden. `inAriaHidden` previously did an exact `=== "true"` check, letting uppercase or whitespace-padded values slip through unflagged.

- [#17](https://github.com/spaansba/out-of-order/pull/17) [`364bf13`](https://github.com/spaansba/out-of-order/commit/364bf1308f395dc31bd479399a3b488613e575d8) Thanks [@spaansba](https://github.com/spaansba)! - `missing-accessible-name` now flags an unlabeled `contenteditable` editing host. A bare `<div contenteditable>` is a real editable textbox and a tab stop, but `isInteractive` only knew native controls and interactive ARIA roles, so every interactive-gated rule skipped it (adding `role="textbox"` made the same box flag). `isInteractive` now recognizes the editing host, keyed on the `contenteditable` attribute rather than the inherited `.isContentEditable` property so descendants of an editable region aren't each counted as a control.

- [#16](https://github.com/spaansba/out-of-order/pull/16) [`94ba981`](https://github.com/spaansba/out-of-order/commit/94ba98188ff5f403922b1a22718a6887f28d32fb) Thanks [@spaansba](https://github.com/spaansba)! - `clickable-not-focusable` no longer flags disabled controls. A `<div role="button" aria-disabled="true">` is meant to be unfocusable, so leaving it out of the tab order is correct, not a keyboard-reachability gap. The rule read role/onclick but never checked `aria-disabled`, so it rang intentionally disabled controls and told you to make them keyboard-reachable. Added an `isAriaDisabled` helper (exported from the package root) and an early skip in the rule.

- [`8d99b5c`](https://github.com/spaansba/out-of-order/commit/8d99b5ca832fecea604571f0f2d4ed6f46aaf478) Thanks [@spaansba](https://github.com/spaansba)! - Internal cleanup: removed the `src/dom/index.ts` re-export barrel so each consumer imports helpers straight from the defining submodule, and dropped now-dead exports it was hiding (`isContentEditingHost` is private again, and the unused `RuleContext` / `RuleRun` type re-exports are gone). No change to the package's public API.

- [`a70898e`](https://github.com/spaansba/out-of-order/commit/a70898e1dec0973766e0ea291ace181eab456aaa) Thanks [@spaansba](https://github.com/spaansba)! - `tabindex-on-noninteractive` now flags a static-content role carrying `tabindex="0"` (e.g. `<div role="note" tabindex="0">`). The rule passed any explicit role other than `presentation`/`none`, so non-interactive document-structure roles slipped through even though they add a dead stop to the tab order. It now passes only interactive roles (already cleared by `isInteractive`) and focusable-container roles like `tabpanel`, flagging the static-content roles.

## 0.3.1

### Patch Changes

- [`3ee7fbc`](https://github.com/spaansba/out-of-order/commit/3ee7fbc5863cebf01eda398eac67a8c412d3ff03) Thanks [@spaansba](https://github.com/spaansba)! - Export a single runtime `AUDIT_FORMATS` (values + labels) from core and derive the type `AuditFormat` from it. The extension, trace, and cli format lists were each a hand-maintained copy of the same four formats with no compile-time link to the type, so adding or renaming a format meant editing four places. They now derive from `AUDIT_FORMATS`.

- [#15](https://github.com/spaansba/out-of-order/pull/15) [`bfca4c6`](https://github.com/spaansba/out-of-order/commit/bfca4c626d5dbba5e13f5ab02fdcc61e4625d69a) Thanks [@spaansba](https://github.com/spaansba)! - Stop building a selector path for every tab stop. `selectorFor` ran eagerly on each entry and dominated an audit (~85% of the pass), yet most stops are never flagged and their selector was never used. `Entry` and `SequenceEntry` no longer carry a `selector` field; call `selectorFor(entry.element)` where a display path is actually needed (it is exported from the package root). `selectorFor` itself now walks siblings directly instead of materializing and filtering each element's child list. A clean-page audit's setup drops ~5x and a full audit ~2x. Serialized outputs (`formatViolations` / `reportText`) still include the `selector` string, computed at format time.

- [`ac93118`](https://github.com/spaansba/out-of-order/commit/ac93118f11002dde8fb363e513b4cef334158eb4) Thanks [@spaansba](https://github.com/spaansba)! - Fix ancestor walks that stopped at shadow boundaries. `compositeAncestor` and `visual-order-mismatch`'s scroll-container lookup used `element.parentElement`, which is `null` for a tab stop that is the top child of an open shadow root, so the walk never reached the shadow host. They now use `composedParent`, so `composite-roving-tabindex` groups shadow-hosted composite items and `visual-order-mismatch` resolves the correct scroll context across the boundary.

- [`3ee7fbc`](https://github.com/spaansba/out-of-order/commit/3ee7fbc5863cebf01eda398eac67a8c412d3ff03) Thanks [@spaansba](https://github.com/spaansba)! - Share one `bySeverity` sort between `audit` and `format` instead of inlining the same severity comparator in both.

- [`bc33025`](https://github.com/spaansba/out-of-order/commit/bc33025caffddb1f07be6d2fb51212bafe462c24) Thanks [@spaansba](https://github.com/spaansba)! - Fix `isNativelyFocusable` misidentifying the real `<summary>`. `parent.querySelector("summary")` scanned the whole subtree in document order, so for `<details><div><summary>x</summary></div><summary>real</summary></details>` the nested summary matched first and the genuine direct-child summary read as not focusable, misjudging `redundant-tabindex` and `tabindex-on-noninteractive`. Now uses `:scope > summary`.

## 0.3.0

### Minor Changes

- [#8](https://github.com/spaansba/out-of-order/pull/8) [`d99c2e1`](https://github.com/spaansba/out-of-order/commit/d99c2e1904886123f12dc16d1a5c3027b0355028) Thanks [@spaansba](https://github.com/spaansba)! - Add per-finding fix suggestions and make CLI audits resilient to slow or auth-gated pages.

  - **core**: findings can now carry a `fix` string with a suggested remediation. All built-in rules provide one, and it is surfaced in every output format (`Issue.fix`, serialized JSON, by-violation grouping, and the text renderer's "Possible fix" line).
  - **trace**: the overlay tooltip renders the fix suggestion under a "Possible fix" label.
  - **cli**: audits now retry while the page has no tabbable elements (new `--tries <n>` flag, default 5, 1s apart), survive client-side redirects mid-audit, report the tabbable-element count, and warn when the audited page looks like a login page (password field or auth-like URL) with instructions to run `out-of-order login`.

## 0.1.1

### Patch Changes

- [#2](https://github.com/spaansba/out-of-order/pull/2) [`0922308`](https://github.com/spaansba/out-of-order/commit/09223082ff59a6fa82b782195afb92b960730358) Thanks [@spaansba](https://github.com/spaansba)! - AnyRuleId to Issue type
