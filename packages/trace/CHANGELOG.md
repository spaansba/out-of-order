# @out-of-order/trace

## 0.5.2

### Patch Changes

- Updated dependencies [[`071cbee`](https://github.com/spaansba/out-of-order/commit/071cbee1a8e9b7ced0b3b78c1736284fed053e5c)]:
  - @out-of-order/core@0.3.3

## 0.5.1

### Patch Changes

- Updated dependencies [[`b3c0d5a`](https://github.com/spaansba/out-of-order/commit/b3c0d5af0a6f5f2e96bdec0d01087368e535f138), [`364bf13`](https://github.com/spaansba/out-of-order/commit/364bf1308f395dc31bd479399a3b488613e575d8), [`94ba981`](https://github.com/spaansba/out-of-order/commit/94ba98188ff5f403922b1a22718a6887f28d32fb), [`8d99b5c`](https://github.com/spaansba/out-of-order/commit/8d99b5ca832fecea604571f0f2d4ed6f46aaf478), [`a70898e`](https://github.com/spaansba/out-of-order/commit/a70898e1dec0973766e0ea291ace181eab456aaa)]:
  - @out-of-order/core@0.3.2

## 0.5.0

### Minor Changes

- [`3104b8d`](https://github.com/spaansba/out-of-order/commit/3104b8d77df173845e36b3b064b2f0289404c159) Thanks [@spaansba](https://github.com/spaansba)! - Make the `AbortSignal` parameter optional on `addCopySplit`, `addSwitch`, and `listenForPeekKey` so callers without a teardown path can omit it. The extension panel no longer allocates throwaway `AbortController`s.

### Patch Changes

- [`3ee7fbc`](https://github.com/spaansba/out-of-order/commit/3ee7fbc5863cebf01eda398eac67a8c412d3ff03) Thanks [@spaansba](https://github.com/spaansba)! - Export a single runtime `AUDIT_FORMATS` (values + labels) from core and derive the type `AuditFormat` from it. The extension, trace, and cli format lists were each a hand-maintained copy of the same four formats with no compile-time link to the type, so adding or renaming a format meant editing four places. They now derive from `AUDIT_FORMATS`.

- [`eb1fd4a`](https://github.com/spaansba/out-of-order/commit/eb1fd4a765622c2975066c4aaf644969125cfe03) Thanks [@spaansba](https://github.com/spaansba)! - Keep the "you are here" badge filled after a re-analysis when focus sits inside an open shadow root. The re-fill on rebuild passed `document.activeElement`, which retargets to the shadow host, so the badge lookup missed and the fill cleared. It now descends the `shadowRoot.activeElement` chain to the real focused element, matching the live `onFocusIn` path.

- Updated dependencies [[`3ee7fbc`](https://github.com/spaansba/out-of-order/commit/3ee7fbc5863cebf01eda398eac67a8c412d3ff03), [`bfca4c6`](https://github.com/spaansba/out-of-order/commit/bfca4c626d5dbba5e13f5ab02fdcc61e4625d69a), [`ac93118`](https://github.com/spaansba/out-of-order/commit/ac93118f11002dde8fb363e513b4cef334158eb4), [`3ee7fbc`](https://github.com/spaansba/out-of-order/commit/3ee7fbc5863cebf01eda398eac67a8c412d3ff03), [`bc33025`](https://github.com/spaansba/out-of-order/commit/bc33025caffddb1f07be6d2fb51212bafe462c24)]:
  - @out-of-order/core@0.3.1

## 0.4.0

### Minor Changes

- [#10](https://github.com/spaansba/out-of-order/pull/10) [`9b478c4`](https://github.com/spaansba/out-of-order/commit/9b478c4f3c016e11e96ead9eedeff5efa82a2296) Thanks [@spaansba](https://github.com/spaansba)! - The overlay is now rendered with CSS anchor positioning: badges and hop connectors anchor to the page elements themselves, so the browser keeps them glued through scrolling (window, nested containers, fixed and sticky elements), resizes, and layout shifts with no per-frame JavaScript. The one exception is a hop between a fixed/sticky stop and an in-flow stop, which spans two scroll regimes that no single anchored box can express: it hides while its scroller is moving and returns, freshly placed from measured geometry, once scrolling settles. The scroll tracker, settle timers, idle sweep, and the `position-observer` dependency are gone. Hop lines are drawn entirely in CSS (quadrant candidate boxes plus container-query trig), badges are HTML instead of SVG, and re-audits on DOM mutation are throttled to at most four per second. Shadow-DOM stops are anchored through `part` tokens and generated `::part()` rules (with `exportparts` forwarding on nested hosts), so their badges and hops render like everything else, including hops that cross a shadow boundary. Requires a browser with CSS anchor positioning (Chrome 125+, Firefox 147+, Safari 26+), matching the tooltip's existing requirement.

- [#10](https://github.com/spaansba/out-of-order/pull/10) [`9b478c4`](https://github.com/spaansba/out-of-order/commit/9b478c4f3c016e11e96ead9eedeff5efa82a2296) Thanks [@spaansba](https://github.com/spaansba)! - `trace()` accepts `controls: false` to skip the floating in-page control panel while keeping the overlay and the peek key active, for hosts that bring their own controls (like the browser extension's side panel).

- [#10](https://github.com/spaansba/out-of-order/pull/10) [`9b478c4`](https://github.com/spaansba/out-of-order/commit/9b478c4f3c016e11e96ead9eedeff5efa82a2296) Thanks [@spaansba](https://github.com/spaansba)! - The handle now drives everything the in-page panel can: `setPeek()` and `setMotion()` join `setVisible()`, with `peeking` readable next to `visible`. A new `onStateChange` option reports visibility/peek flips from any source (API, panel, or peek key) so hosts with their own UI can mirror them. The panel's copy split button and switch rows are exported (`addCopySplit`, `addSwitch`, `setSwitch`) for such hosts. Tooltips render through DOMParser instead of innerHTML, so hovering works on pages enforcing Trusted Types.

## 0.3.0

### Minor Changes

- [#8](https://github.com/spaansba/out-of-order/pull/8) [`d99c2e1`](https://github.com/spaansba/out-of-order/commit/d99c2e1904886123f12dc16d1a5c3027b0355028) Thanks [@spaansba](https://github.com/spaansba)! - Add per-finding fix suggestions and make CLI audits resilient to slow or auth-gated pages.

  - **core**: findings can now carry a `fix` string with a suggested remediation. All built-in rules provide one, and it is surfaced in every output format (`Issue.fix`, serialized JSON, by-violation grouping, and the text renderer's "Possible fix" line).
  - **trace**: the overlay tooltip renders the fix suggestion under a "Possible fix" label.
  - **cli**: audits now retry while the page has no tabbable elements (new `--tries <n>` flag, default 5, 1s apart), survive client-side redirects mid-audit, report the tabbable-element count, and warn when the audited page looks like a login page (password field or auth-like URL) with instructions to run `out-of-order login`.

### Patch Changes

- Updated dependencies [[`d99c2e1`](https://github.com/spaansba/out-of-order/commit/d99c2e1904886123f12dc16d1a5c3027b0355028)]:
  - @out-of-order/core@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`0922308`](https://github.com/spaansba/out-of-order/commit/09223082ff59a6fa82b782195afb92b960730358)]:
  - @out-of-order/core@0.1.1
