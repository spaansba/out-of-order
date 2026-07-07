# @out-of-order/trace

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
