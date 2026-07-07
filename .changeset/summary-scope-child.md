---
"@out-of-order/core": patch
---

Fix `isNativelyFocusable` misidentifying the real `<summary>`. `parent.querySelector("summary")` scanned the whole subtree in document order, so for `<details><div><summary>x</summary></div><summary>real</summary></details>` the nested summary matched first and the genuine direct-child summary read as not focusable, misjudging `redundant-tabindex` and `tabindex-on-noninteractive`. Now uses `:scope > summary`.
