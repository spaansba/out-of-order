// The `.ooo-*` selectors below are written out literally for readability; every
// class the JS applies shares the same `ooo-` prefix, so the namespace can't
// drift. Rings are the exception (see ring.ts): they key on the data-ooo-ring
// attribute rather than a class.

export const OVERLAY_CSS = `
/* The layer must NOT be positioned: badges and hops anchor() to page elements,
   and an anchor is only acceptable when the positioned element's containing
   block is an ancestor of the anchor's. Keeping the layer (and .ooo-draw)
   static makes that containing block the ICB, which contains everything. */
.ooo-layer { width: 0; height: 0; pointer-events: none;
  --ooo-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --ooo-ink: #18191c; --ooo-ink-2: #34352d; --ooo-muted: #74756d; --ooo-muted-2: #8a8b80;
  --ooo-line: #dcd9cd; --ooo-line-2: #c6c2b4; --ooo-surface: #fffefb; --ooo-btn: #ecebe4;
  --ooo-accent: #1f4e79; --ooo-ok: #2f6a47; --ooo-ok-strong: #1f7a44;
  --ooo-warn: #9a7d1a; --ooo-bad: #a01f17; }
.ooo-draw { width: 0; height: 0; pointer-events: none; }

/* position-anchor (the default anchor) rather than a named anchor() ref is
   what buys compositor-driven scroll adjustment inside nested scrollers. */
.ooo-badge { position: absolute; position-anchor: var(--ooo-anchor);
  left: anchor(center); top: anchor(center); translate: -50% -50%;
  z-index: 2147483646; box-sizing: border-box;
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  --ooo-c: var(--ooo-ok);
  color: var(--ooo-c); background: var(--ooo-surface); border: 1.5px solid var(--ooo-c);
  font: 500 11px var(--ooo-mono);
  pointer-events: auto; cursor: help; }
.ooo-badge--warn { --ooo-c: var(--ooo-warn); }
.ooo-badge--bad { --ooo-c: var(--ooo-bad); }
.ooo-badge--off { font-size: 12px; }
/* Badges read hollow by default, then fill in solid while their element is
   keyboard-focused, so the badge doubles as a "you are here" cursor. */
.ooo-badge--on { background: var(--ooo-c); color: var(--ooo-surface); }

/* Autofocus indicator: small "focus lands here" disc off the badge corner. */
.ooo-af { position: absolute; right: -8px; top: -8px; width: 14px; height: 14px;
  border-radius: 50%; background: var(--ooo-accent); border: 1.5px solid var(--ooo-surface);
  box-sizing: border-box; }
.ooo-af::after { content: ""; position: absolute; inset: 0; margin: auto;
  width: 7px; height: 5px; background: var(--ooo-surface);
  clip-path: polygon(0 0, 100% 0, 50% 100%); }

/* Hops: the connector between consecutive badges. The box spans the two badge
   centers; which quadrant the destination sits in (se/ne/sw/nw) is chosen in
   JS and baked into the class, so one box replaces the old four candidates
   (anchored boxes are the dominant layout cost on large pages). Placement
   still rides CSS anchors, so scroll compensation is unchanged, and the box is
   a size container: the line derives its own length (hypot) and angle (atan2)
   from the box's aspect ratio. A reflow can flip the true quadrant out from
   under the baked class (the stale insets then compute a negative, clamped-to-
   zero size), so the renderer restamps it from live geometry on resize frames
   and scroll/build settles. The -0.5px epsilon grows each axis by 1px so an
   axis-aligned hop (centers equal on one axis) still has a non-zero box for
   the cq math. */
.ooo-hop { position: absolute; container-type: size; pointer-events: none;
  z-index: 2147483646; color: var(--ooo-ok);
  position-anchor: var(--ooo-from); }
.ooo-hop--back { color: var(--ooo-bad); }
.ooo-hop--se {
  left: calc(anchor(var(--ooo-from) center) - 0.5px);
  top: calc(anchor(var(--ooo-from) center) - 0.5px);
  right: calc(anchor(var(--ooo-to) center) - 0.5px);
  bottom: calc(anchor(var(--ooo-to) center) - 0.5px); }
.ooo-hop--ne {
  left: calc(anchor(var(--ooo-from) center) - 0.5px);
  bottom: calc(anchor(var(--ooo-from) center) - 0.5px);
  right: calc(anchor(var(--ooo-to) center) - 0.5px);
  top: calc(anchor(var(--ooo-to) center) - 0.5px); }
.ooo-hop--sw {
  right: calc(anchor(var(--ooo-from) center) - 0.5px);
  top: calc(anchor(var(--ooo-from) center) - 0.5px);
  left: calc(anchor(var(--ooo-to) center) - 0.5px);
  bottom: calc(anchor(var(--ooo-to) center) - 0.5px); }
.ooo-hop--nw {
  right: calc(anchor(var(--ooo-from) center) - 0.5px);
  bottom: calc(anchor(var(--ooo-from) center) - 0.5px);
  left: calc(anchor(var(--ooo-to) center) - 0.5px);
  top: calc(anchor(var(--ooo-to) center) - 0.5px); }

/* The line: pinned to A's corner of the surviving box, rotated toward B's
   corner. The box is a size container, so its own aspect ratio gives the exact
   angle (atan2) and length (hypot) in pure CSS. --ooo-angle is defined on the
   hop but the cq units resolve at the child, against the hop's size. The 17px
   height is the hover hit area (the visible stripe is the ::before); it may
   overhang the box like the old SVG's overflow:visible. */
.ooo-hop-line { position: absolute; width: hypot(100cqw, 100cqh); height: 17px;
  translate: 0 -50%; transform-origin: 0 50%; rotate: var(--ooo-angle);
  pointer-events: none; }
.ooo-hop--se { --ooo-angle: atan2(100cqh, 100cqw); }
.ooo-hop--ne { --ooo-angle: atan2(-100cqh, 100cqw); }
.ooo-hop--sw { --ooo-angle: atan2(100cqh, -100cqw); }
.ooo-hop--nw { --ooo-angle: atan2(-100cqh, -100cqw); }
.ooo-hop--se .ooo-hop-line { left: 0; top: 0; }
.ooo-hop--ne .ooo-hop-line { left: 0; top: 100%; }
.ooo-hop--sw .ooo-hop-line { left: 100%; top: 0; }
.ooo-hop--nw .ooo-hop-line { left: 100%; top: 100%; }

/* The visible stripe, dashed via gradient. Dash period 7+6=13, matching the
   marching animation below. */
.ooo-hop-line::before { content: ""; position: absolute; left: 0; right: 0;
  top: 50%; height: 2px; translate: 0 -50%; opacity: 0.92;
  background: repeating-linear-gradient(90deg, currentColor 0 7px, transparent 7px 13px); }
.ooo-hop--back .ooo-hop-line::before { height: 2.25px; }
/* Only backward (red) hops are hoverable; forward (green) hops stay click-through. */
.ooo-hop--back .ooo-hop-line { pointer-events: auto; cursor: help; }

/* Anchor scroll compensation only covers the anchor's own scroll chain, so
   document-space boxes drift off fixed/sticky elements; fixed boxes track them. */
.ooo-fix { position: fixed; }

/* Seam hops (one floating end, one in-flow) are JS-placed and can't stay glued
   mid-scroll, so they duck out fast while scrolling and ease back on settle. */
.ooo-hop--seam { transition: opacity 0.15s ease; }
.ooo-layer[data-ooo-shifting] .ooo-hop--seam { opacity: 0; transition-duration: 0.05s; }

/* "Peek": turn the overlay click-through (badges + backward hit-lines stop
   intercepting) and fade the drawing back, so the page beneath stays usable. Scoped
   to .ooo-draw so the control panel, which reports the state, stays legible. */
.ooo-layer[data-ooo-peek="on"] .ooo-draw { opacity: 0.25; }
.ooo-layer[data-ooo-peek="on"] .ooo-badge,
.ooo-layer[data-ooo-peek="on"] .ooo-hop--back .ooo-hop-line { pointer-events: none; }

/* "Overlay" off hides the drawing + hit-lines but leaves the panel (the way back)
   in place; the renderer hides the on-page rings separately. */
.ooo-layer.ooo-hidden .ooo-draw { display: none; }

/* Advance by exactly one dash period (7 + 6 = 13) per cycle so the marching dashes
   loop seamlessly. Must stay in sync with the stripe gradient above. */
@keyframes ooo-flow { to { background-position-x: 13px; } }
@keyframes ooo-cast {
  0% { transform: scale(1); }
  35% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.ooo-layer[data-ooo-motion="play"] .ooo-hop-line::before { animation: ooo-flow 1.1s linear infinite; }
.ooo-layer[data-ooo-motion="play"] .ooo-hop--back .ooo-hop-line::before { animation-duration: 0.8s; }
.ooo-layer[data-ooo-motion="play"] .ooo-badge--on { animation: ooo-cast 0.4s ease-out; }
`;
