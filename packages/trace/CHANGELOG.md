# @out-of-order/trace

## 0.3.0

### Minor Changes

- [#8](https://github.com/spaansba/out-of-order/pull/8) [`d99c2e1`](https://github.com/spaansba/out-of-order/commit/d99c2e1904886123f12dc16d1a5c3027b0355028) Thanks [@spaansba](https://github.com/spaansba)! - Add per-finding fix suggestions and make CLI audits resilient to slow or auth-gated pages.

  - **core**: findings can now carry a `fix` string with a suggested remediation. All built-in rules provide one, and it is surfaced in every output format (`Issue.fix`, serialized JSON, by-violation grouping, and the text renderer's "Possible fix" line).
  - **trace**: the overlay tooltip renders the fix suggestion under a "Possible fix" label.
  - **cli**: audits now retry while the page has no tabbable elements (new `--tries <n>` flag, default 5, 1s apart), survive client-side redirects mid-audit, report the tabbable-element count, and warn when the audited page looks like a login page (password field or auth-like URL) with instructions to run `out-of-order login`.

### Patch Changes

- Updated dependencies [[`d99c2e1`](https://github.com/spaansba/out-of-order/commit/d99c2e1904886123f12dc16d1a5c3027b0355028)]:
  - @out-of-order/core@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`0922308`](https://github.com/spaansba/out-of-order/commit/09223082ff59a6fa82b782195afb92b960730358)]:
  - @out-of-order/core@0.1.1
