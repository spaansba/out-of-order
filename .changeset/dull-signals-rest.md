---
"@out-of-order/trace": minor
"@out-of-order/extension": patch
---

Make the `AbortSignal` parameter optional on `addCopySplit`, `addSwitch`, and `listenForPeekKey` so callers without a teardown path can omit it. The extension panel no longer allocates throwaway `AbortController`s.
