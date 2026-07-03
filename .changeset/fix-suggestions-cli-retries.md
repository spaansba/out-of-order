---
"@out-of-order/core": minor
"@out-of-order/cli": minor
"@out-of-order/trace": minor
---

Add per-finding fix suggestions and make CLI audits resilient to slow or auth-gated pages.

- **core**: findings can now carry a `fix` string with a suggested remediation. All built-in rules provide one, and it is surfaced in every output format (`Issue.fix`, serialized JSON, by-violation grouping, and the text renderer's "Possible fix" line).
- **trace**: the overlay tooltip renders the fix suggestion under a "Possible fix" label.
- **cli**: audits now retry while the page has no tabbable elements (new `--tries <n>` flag, default 5, 1s apart), survive client-side redirects mid-audit, report the tabbable-element count, and warn when the audited page looks like a login page (password field or auth-like URL) with instructions to run `out-of-order login`.
