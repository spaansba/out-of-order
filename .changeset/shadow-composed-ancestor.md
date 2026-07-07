---
"@out-of-order/core": patch
---

Fix ancestor walks that stopped at shadow boundaries. `compositeAncestor` and `visual-order-mismatch`'s scroll-container lookup used `element.parentElement`, which is `null` for a tab stop that is the top child of an open shadow root, so the walk never reached the shadow host. They now use `composedParent`, so `composite-roving-tabindex` groups shadow-hosted composite items and `visual-order-mismatch` resolves the correct scroll context across the boundary.
