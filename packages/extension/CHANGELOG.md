# @out-of-order/extension

## 0.1.1

### Patch Changes

- [`3ee7fbc`](https://github.com/spaansba/out-of-order/commit/3ee7fbc5863cebf01eda398eac67a8c412d3ff03) Thanks [@spaansba](https://github.com/spaansba)! - Export a single runtime `AUDIT_FORMATS` (values + labels) from core and derive the type `AuditFormat` from it. The extension, trace, and cli format lists were each a hand-maintained copy of the same four formats with no compile-time link to the type, so adding or renaming a format meant editing four places. They now derive from `AUDIT_FORMATS`.

- [`3104b8d`](https://github.com/spaansba/out-of-order/commit/3104b8d77df173845e36b3b064b2f0289404c159) Thanks [@spaansba](https://github.com/spaansba)! - Make the `AbortSignal` parameter optional on `addCopySplit`, `addSwitch`, and `listenForPeekKey` so callers without a teardown path can omit it. The extension panel no longer allocates throwaway `AbortController`s.

- [`50cef65`](https://github.com/spaansba/out-of-order/commit/50cef65c76dabe76cc77e4323a317eaf57bed678) Thanks [@spaansba](https://github.com/spaansba)! - Fix a leaked content-script port when granting host access. Granting the permission fired `attachActive()` twice (once from the `permissions.request` callback and once from `permissions.onAdded`), so two concurrent attaches raced and orphaned a port. The grant is now handled solely by `permissions.onAdded`.

- [`1c80a82`](https://github.com/spaansba/out-of-order/commit/1c80a82d67d16c290cc933e980553bc72a117b38) Thanks [@spaansba](https://github.com/spaansba)! - Guard `attach()` against overlapping runs so a superseded attach can't orphan a port. `detach()` at the top could not disconnect the previous port because it was still unset while `executeScript` awaited, so a fast tab switch on a slow-injecting page left the first port connected: its `onMessage` kept pushing the old tab's snapshots into the panel and the old content script never got `onDisconnect`. A generation token now makes any superseded attach bail out before opening a port.
