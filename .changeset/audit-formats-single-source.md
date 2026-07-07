---
"@out-of-order/core": patch
"@out-of-order/extension": patch
"@out-of-order/trace": patch
"@out-of-order/cli": patch
---

Export a single runtime `AUDIT_FORMATS` (values + labels) from core and derive the type `AuditFormat` from it. The extension, trace, and cli format lists were each a hand-maintained copy of the same four formats with no compile-time link to the type, so adding or renaming a format meant editing four places. They now derive from `AUDIT_FORMATS`.
