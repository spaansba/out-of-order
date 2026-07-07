---
"@out-of-order/core": patch
---

Stop building a selector path for every tab stop. `selectorFor` ran eagerly on each entry and dominated an audit (~85% of the pass), yet most stops are never flagged and their selector was never used. `Entry` and `SequenceEntry` no longer carry a `selector` field; call `selectorFor(entry.element)` where a display path is actually needed (it is exported from the package root). `selectorFor` itself now walks siblings directly instead of materializing and filtering each element's child list. A clean-page audit's setup drops ~5x and a full audit ~2x. Serialized outputs (`formatViolations` / `reportText`) still include the `selector` string, computed at format time.
