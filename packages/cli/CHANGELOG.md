# @out-of-order/cli

## 0.3.1

### Patch Changes

- [`3ee7fbc`](https://github.com/spaansba/out-of-order/commit/3ee7fbc5863cebf01eda398eac67a8c412d3ff03) Thanks [@spaansba](https://github.com/spaansba)! - Export a single runtime `AUDIT_FORMATS` (values + labels) from core and derive the type `AuditFormat` from it. The extension, trace, and cli format lists were each a hand-maintained copy of the same four formats with no compile-time link to the type, so adding or renaming a format meant editing four places. They now derive from `AUDIT_FORMATS`.

- [`8bed68e`](https://github.com/spaansba/out-of-order/commit/8bed68eae15eabdf421b580e972b80cac10b204e) Thanks [@spaansba](https://github.com/spaansba)! - Thread overlay rule overrides through Playwright's `addInitScript` argument instead of hand-building a JS source string. The overlay path previously interpolated `JSON.stringify(rules)` into script text, a separate serialization path from the structured arg the non-overlay `page.evaluate` uses. Both now use Playwright's own serialization.

## 0.3.0

### Minor Changes

- [#8](https://github.com/spaansba/out-of-order/pull/8) [`d99c2e1`](https://github.com/spaansba/out-of-order/commit/d99c2e1904886123f12dc16d1a5c3027b0355028) Thanks [@spaansba](https://github.com/spaansba)! - Add per-finding fix suggestions and make CLI audits resilient to slow or auth-gated pages.

  - **core**: findings can now carry a `fix` string with a suggested remediation. All built-in rules provide one, and it is surfaced in every output format (`Issue.fix`, serialized JSON, by-violation grouping, and the text renderer's "Possible fix" line).
  - **trace**: the overlay tooltip renders the fix suggestion under a "Possible fix" label.
  - **cli**: audits now retry while the page has no tabbable elements (new `--tries <n>` flag, default 5, 1s apart), survive client-side redirects mid-audit, report the tabbable-element count, and warn when the audited page looks like a login page (password field or auth-like URL) with instructions to run `out-of-order login`.

## 0.2.2

### Patch Changes

- [`1f01630`](https://github.com/spaansba/out-of-order/commit/1f01630af6d61f8e68e27372d5aea4393f901893) Thanks [@spaansba](https://github.com/spaansba)! - Headless audits no longer advertise `HeadlessChrome` in the user agent. Backends that reject it served the audit a login or block page the headed `--overlay` never sees, so the two commands silently disagreed. Headless runs now present the same UA a headed run would.

  Audits that find zero tabbable elements now exit 2 with a hint to use `--wait <selector>`, instead of passing silently. A page that renders after load (SPA loading screen) produced a vacuous "No tab-order issues."

## 0.1.1

### Patch Changes

- Updated dependencies [[`0922308`](https://github.com/spaansba/out-of-order/commit/09223082ff59a6fa82b782195afb92b960730358)]:
  - @out-of-order/core@0.1.1
  - @out-of-order/trace@0.1.1
