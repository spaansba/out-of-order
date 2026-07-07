---
"@out-of-order/cli": patch
---

Thread overlay rule overrides through Playwright's `addInitScript` argument instead of hand-building a JS source string. The overlay path previously interpolated `JSON.stringify(rules)` into script text, a separate serialization path from the structured arg the non-overlay `page.evaluate` uses. Both now use Playwright's own serialization.
