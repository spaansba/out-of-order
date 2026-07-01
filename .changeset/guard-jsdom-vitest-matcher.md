---
"@out-of-order/vitest": patch
---

`toHaveValidTabOrder()` now throws a clear error when run under jsdom instead of silently producing misleading results. The matcher reads CSS layout, which jsdom cannot provide, so it needs a real browser (Vitest Browser Mode).
