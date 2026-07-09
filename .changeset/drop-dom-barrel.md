---
"@out-of-order/core": patch
---

Internal cleanup: removed the `src/dom/index.ts` re-export barrel so each consumer imports helpers straight from the defining submodule, and dropped now-dead exports it was hiding (`isContentEditingHost` is private again, and the unused `RuleContext` / `RuleRun` type re-exports are gone). No change to the package's public API.
