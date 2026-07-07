---
"@out-of-order/trace": minor
---

The handle now drives everything the in-page panel can: `setPeek()` and `setMotion()` join `setVisible()`, with `peeking` readable next to `visible`. A new `onStateChange` option reports visibility/peek flips from any source (API, panel, or peek key) so hosts with their own UI can mirror them. The panel's copy split button and switch rows are exported (`addCopySplit`, `addSwitch`, `setSwitch`) for such hosts. Tooltips render through DOMParser instead of innerHTML, so hovering works on pages enforcing Trusted Types.
