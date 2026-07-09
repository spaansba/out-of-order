---
"@out-of-order/core": patch
---

The tab sequence no longer includes elements inside `content-visibility: hidden` subtrees (including `hidden="until-found"`). The browser's Tab key skips these, so they were phantom stops that inflated the sequence and produced false `hidden-while-focusable` errors. Genuinely tabbable-but-invisible elements (`opacity: 0`, off-screen positioning) are still reported, and `content-visibility: auto` content stays in the sequence.
