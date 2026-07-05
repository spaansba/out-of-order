// The `.ooo-*` selectors in the CSS below are written out literally for
// readability; every class the JS applies shares the same `ooo-` prefix, so the
// namespace can't drift. Rings are the exception: they mark page elements rather
// than overlay nodes, so they key on the data-ooo-ring attribute, never a class.

const RING_CSS = `
[data-ooo-ring] { outline: 1px dashed rgba(47, 106, 71, 0.5); outline-offset: 2px; }
[data-ooo-ring="warn"] { outline: 1.5px dashed rgba(154, 125, 26, 0.8); outline-offset: 2px; }
[data-ooo-ring="bad"] { outline: 1.5px solid rgba(160, 31, 23, 0.74); outline-offset: 2px; }
[data-ooo-ring]:focus-visible { outline: revert; }
`;

const OVERLAY_CSS = `
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
${RING_CSS}
/* "Peek": turn the overlay click-through (badges + backward hit-lines stop
   intercepting) and fade the drawing back, so the page beneath stays usable. Scoped
   to .ooo-draw so the control panel, which reports the state, stays legible. */
.ooo-layer[data-ooo-peek="on"] .ooo-draw { opacity: 0.25; }
.ooo-layer[data-ooo-peek="on"] .ooo-badge,
.ooo-layer[data-ooo-peek="on"] .ooo-hop--back .ooo-hop-line { pointer-events: none; }

/* "Overlay" off hides the drawing + hit-lines but leaves the panel (the way back)
   in place; the renderer hides the on-page rings separately. */
.ooo-layer.ooo-hidden .ooo-draw { display: none; }

/* Control panel: a fixed-width card pinned to a corner, styled to match the demo
   chrome. It holds two identical on/off switches (overlay + click-through). Palette
   inlined: the overlay mounts on arbitrary pages and can't reach the demo's vars. */
.ooo-panel, .ooo-panel * { box-sizing: border-box; }
.ooo-panel { position: fixed; left: 12px; bottom: 12px; z-index: 2147483646;
  width: 188px; pointer-events: auto; margin: 0; padding: 10px;
  display: flex; flex-direction: column; gap: 9px;
  background: #f5f4ef; border: 1px solid var(--ooo-line-2); border-radius: 3px;
  box-shadow: 0 10px 30px -12px rgba(24, 25, 28, 0.32), 0 1px 2px rgba(24, 25, 28, 0.08);
  font: 500 12px/1 var(--ooo-mono); }
/* Title doubles as the collapse toggle: full-width button, +/- sign on the right
   tells which way it folds. Reset the UA button look back to the card's type. */
.ooo-panel-title { display: flex; align-items: center; width: 100%; margin: 0;
  padding: 0 0 9px; border: 0; border-bottom: 1px solid var(--ooo-line); background: none;
  font: 600 13px/1 inherit; color: var(--ooo-ink); letter-spacing: 0.01em;
  text-align: left; cursor: pointer; }
.ooo-panel-title::after { content: "\\2212"; margin-left: auto; padding-left: 12px;
  color: var(--ooo-muted); font-size: 14px; }
.ooo-panel-title:hover { color: #000; }
.ooo-panel-title:hover::after { color: var(--ooo-ink); }
.ooo-panel-body { display: flex; flex-direction: column; gap: 9px; }
/* Collapsed: fold the body away, leave the bare title bar (no divider, +/- flips). */
.ooo-panel[data-open="0"] .ooo-panel-title { padding-bottom: 0; border-bottom: 0; }
.ooo-panel[data-open="0"] .ooo-panel-title::after { content: "+"; }
.ooo-panel[data-open="0"] .ooo-panel-body { display: none; }
.ooo-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ooo-row-label { color: var(--ooo-ink-2); }
/* Toggle switch: a pill track with a sliding knob; accent track + knob right when on. */
.ooo-switch { flex: none; position: relative; width: 32px; height: 18px; margin: 0; padding: 0;
  border: 1px solid var(--ooo-line-2); border-radius: 999px; background: #e7e4da; cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease; }
.ooo-switch-knob { position: absolute; top: 1px; left: 1px; width: 14px; height: 14px;
  border-radius: 50%; background: var(--ooo-surface); box-shadow: 0 1px 2px rgba(24, 25, 28, 0.3);
  transition: transform 0.14s ease; }
.ooo-switch--on { background: var(--ooo-accent); border-color: var(--ooo-accent); }
.ooo-switch--on .ooo-switch-knob { transform: translateX(14px); }
.ooo-switch:disabled { cursor: default; opacity: 0.4; }
.ooo-panel-hint { margin: 1px 0 0; color: var(--ooo-muted); font-size: 10.5px; letter-spacing: 0.01em; }
/* Copy findings: a split button. The main face copies in the current format; the
   caret to its right opens a menu to switch it, GitHub-merge-button style. */
.ooo-copy-split { position: relative; display: flex; }
.ooo-copy { flex: 1 1 auto; min-width: 0; margin: 0; padding: 6px 8px;
  border: 1px solid var(--ooo-line-2); border-radius: 3px 0 0 3px; background: var(--ooo-btn); color: var(--ooo-ink-2);
  font: 600 11px/1 var(--ooo-mono);
  letter-spacing: 0.02em; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease; }
.ooo-copy-caret { flex: none; width: 26px; margin-left: -1px; padding: 0;
  border: 1px solid var(--ooo-line-2); border-radius: 0 3px 3px 0; background: var(--ooo-btn); color: var(--ooo-ink-2);
  font: 600 11px/1 var(--ooo-mono); cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease; }
/* Raise whichever half is hovered so its border draws over the shared seam. */
.ooo-copy:hover, .ooo-copy-caret:hover { position: relative; z-index: 1;
  background: #e2e0d6; border-color: #b7b3a4; color: var(--ooo-ink); }
.ooo-copy-menu { position: absolute; left: 0; right: 0; bottom: 100%; margin-bottom: 5px;
  display: flex; flex-direction: column; padding: 3px; z-index: 2;
  background: var(--ooo-surface); border: 1px solid var(--ooo-line-2); border-radius: 3px;
  box-shadow: 0 10px 30px -12px rgba(24, 25, 28, 0.4), 0 1px 2px rgba(24, 25, 28, 0.08); }
.ooo-copy-menu[hidden] { display: none; }
.ooo-copy-item { display: flex; align-items: center; width: 100%; margin: 0;
  padding: 5px 7px; border: 0; border-radius: 2px; background: none; color: var(--ooo-ink-2);
  letter-spacing: 0.02em; text-align: left; cursor: pointer;
  font: 500 11px/1 var(--ooo-mono); }
.ooo-copy-item:hover { background: var(--ooo-btn); color: var(--ooo-ink); }
.ooo-copy-item::before { content: "\\2713"; width: 13px; color: var(--ooo-accent); visibility: hidden; }
.ooo-copy-item--on { color: var(--ooo-ink); }
.ooo-copy-item--on::before { visibility: visible; }

.ooo-tip-anchor { position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; anchor-name: --ooo-tip-anchor; }

.ooo-tip { position: fixed; position-anchor: --ooo-tip-anchor;
  inset: auto; top: anchor(center); left: anchor(center); margin: 19px 0 0 -11px;
  position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  pointer-events: auto; width: max-content; max-width: 360px;
  background-color: var(--ooo-surface);
  background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>");
  color: var(--ooo-ink); border: 1px solid var(--ooo-line-2); border-radius: 2px;
  font: 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 18px 48px -14px rgba(24,25,28,0.34), 0 2px 5px rgba(24,25,28,0.08); }

.ooo-tip-head { display: flex; align-items: center; gap: 10px; padding: 9px 12px; }
.ooo-tip-idx { flex: none; align-self: stretch; display: flex; align-items: center;
  padding-right: 10px; border-right: 1px solid var(--ooo-line);
  font: 500 14px/1 var(--ooo-mono);
  letter-spacing: -0.01em; color: var(--ooo-accent); }
.ooo-tip-idx--off { color: var(--ooo-warn); font-size: 15px; }
.ooo-tip-sel { min-width: 0; font: 12px/1.45 var(--ooo-mono);
  color: var(--ooo-ink-2); word-break: break-word; }

.ooo-tip-fields { margin: 0; padding: 8px 12px; border-top: 1px solid var(--ooo-line);
  display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; align-items: baseline; }
.ooo-tip-fields dt { margin: 0;
  font: 600 9.5px/1.5 var(--ooo-mono);
  letter-spacing: 0.07em; text-transform: uppercase; color: var(--ooo-muted-2); }
.ooo-tip-fields dd { margin: 0; min-width: 0; color: var(--ooo-ink-2); font-size: 12.5px; word-break: break-word; }
.ooo-tip-mono { font-family: var(--ooo-mono);
  font-size: 11.5px; color: var(--ooo-ink); }
.ooo-tip-dim { color: #b0b1a6; }

.ooo-tip-body { padding: 9px 12px; border-top: 1px solid var(--ooo-line); }
.ooo-tip-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 9px; }
.ooo-tip-item { display: block; }
.ooo-tip-rule { display: flex; align-items: center; gap: 5px; width: fit-content; margin-bottom: 3px;
  font: 600 10px/1.4 var(--ooo-mono);
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--ooo-bad); text-decoration: none; }
.ooo-tip-rule--warn { color: var(--ooo-warn); }
a.ooo-tip-rule:hover > span { text-decoration: underline; text-underline-offset: 2px; }
.ooo-tip-rule-ic { flex: none; opacity: 0.55; }
a.ooo-tip-rule:hover .ooo-tip-rule-ic { opacity: 1; }
.ooo-tip-msg { display: block; margin: 0; color: var(--ooo-ink-2); font-size: 12.5px; }
.ooo-tip-code { font-family: var(--ooo-mono); font-size: 0.88em; padding: 0.5px 3px;
  border-radius: 2px; background: var(--ooo-btn); color: var(--ooo-ink); }
.ooo-tip-fix { display: block; margin-top: 5px; padding-left: 9px;
  border-left: 2px solid var(--ooo-line-2); color: var(--ooo-ink-2); font-size: 12px; }
.ooo-tip-fix-label { display: block;
  font: 600 9.5px/1.6 var(--ooo-mono);
  letter-spacing: 0.07em; text-transform: uppercase; color: var(--ooo-muted-2); }
.ooo-tip-ok { margin: 0; color: var(--ooo-ok-strong); font-size: 12.5px; }
.ooo-tip-item--ignored { opacity: 0.7; }
.ooo-tip-item--ignored .ooo-tip-rule { color: var(--ooo-muted-2); }
.ooo-tip-ignored { display: block; margin-top: 4px; color: var(--ooo-muted); font-size: 11.5px; }
.ooo-tip-ignored code { font-family: var(--ooo-mono);
  font-size: 11px; }

/* hop tooltips reuse the frame without the index column */
.ooo-tip-flag { flex: none;
  font: 600 10px/1.4 var(--ooo-mono);
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--ooo-ok-strong); }
.ooo-tip-flag--back { color: var(--ooo-bad); }
.ooo-tip-hop { font: 500 13px/1 var(--ooo-mono);
  color: var(--ooo-ink); }


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

const overlaySheet = new CSSStyleSheet();
overlaySheet.replaceSync(OVERLAY_CSS);
const ringSheet = new CSSStyleSheet();
ringSheet.replaceSync(RING_CSS);
function adopt(root: DocumentOrShadowRoot, sheet: CSSStyleSheet): void {
  if (root.adoptedStyleSheets.includes(sheet)) {
    return;
  }

  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

/** Make the full overlay stylesheet available on the document. */
export function ensureStyles(): void {
  adopt(document, overlaySheet);
}

/** Anchor rules are per trace instance, not module state: the page's overlay
    and the extension's can briefly coexist around a takeover, and a shared
    sheet would let one wipe the other's anchors on clear. */
export function createAnchorSheet(): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  adopt(document, sheet);
  return sheet;
}

export function releaseAnchorSheet(sheet: CSSStyleSheet): void {
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((other) => other !== sheet);
}

// Attribute-keyed rules rather than inline styles, so the page's style
// attributes stay untouched (mirrors the data-ooo-ring pattern). Each id also
// gets a ::part selector: shadow elements carry a part token instead of the
// attribute, which is the one way a document-scope rule (and so the layer's
// anchor() refs) can name an element across a shadow boundary.
export function setAnchorRules(sheet: CSSStyleSheet, token: number, count: number): void {
  sheet.replaceSync(
    Array.from({ length: count }, (_, id) => {
      const key = `${token}-${id}`;
      return `[data-ooo-anchor="${key}"], ::part(ooo-${key}) { anchor-name: --ooo-${key}; }`;
    }).join("\n"),
  );
}

/** Mirror just the ring rules into a shadow root (document styles don't cross
    the boundary), so a ringed element inside it still gets its outline. */
export function ensureRingStyles(root: ShadowRoot): void {
  adopt(root, ringSheet);
}
