---
"@out-of-order/trace": patch
---

Keep the "you are here" badge filled after a re-analysis when focus sits inside an open shadow root. The re-fill on rebuild passed `document.activeElement`, which retargets to the shadow host, so the badge lookup missed and the fill cleared. It now descends the `shadowRoot.activeElement` chain to the real focused element, matching the live `onFocusIn` path.
