---
"@out-of-order/extension": patch
---

Fix a leaked content-script port when granting host access. Granting the permission fired `attachActive()` twice (once from the `permissions.request` callback and once from `permissions.onAdded`), so two concurrent attaches raced and orphaned a port. The grant is now handled solely by `permissions.onAdded`.
