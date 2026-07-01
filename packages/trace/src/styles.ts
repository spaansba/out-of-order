// The `.ooo-*` selectors in the CSS below are written out literally for
// readability; the class names the JS applies live in classes.ts and share its
// prefix, so they can't drift from this namespace.
export { RING_CLASS, RING_BAD_CLASS, RING_WARN_CLASS } from "./classes.js";

const RING_CSS = `
.ooo-ring { outline: 1px dashed rgba(47, 106, 71, 0.5); outline-offset: 2px; }
.ooo-ring--warn { outline: 1.5px dashed rgba(154, 125, 26, 0.8); outline-offset: 2px; }
.ooo-ring--bad { outline: 1.5px solid rgba(160, 31, 23, 0.74); outline-offset: 2px; }
.ooo-ring:focus-visible, .ooo-ring--warn:focus-visible, .ooo-ring--bad:focus-visible { outline: revert; }
`;

const OVERLAY_CSS = `
.ooo-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.ooo-svg { position: absolute; top: 0; left: 0; overflow: visible; }
.ooo-seg { fill: none; stroke: #2f6a47; stroke-width: 2; opacity: 0.92;
  stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 7 6; }
.ooo-seg--back { stroke: #a01f17; stroke-width: 2.25; }
.ooo-hit { fill: none; stroke: transparent; stroke-width: 18; pointer-events: none; cursor: help; }
/* Only backward (red) hops are hoverable; forward (green) hops stay click-through. */
.ooo-hit--back { pointer-events: stroke; }
${RING_CSS}
/* Badges read hollow by default (white fill, coloured outline and number), then
   fill in solid while their element is keyboard-focused, so the badge doubles as
   a "you are here" cursor that moves as you Tab. */
/* Every badge is hoverable (auto) so its tooltip opens on hover (the layer itself
   is pointer-events:none). The badge is a small disc at the element's centre, so
   it only intercepts clicks dead-centre. */
.ooo-badge { pointer-events: auto; cursor: help; }
/* "Peek": turn the overlay click-through (badges + backward hit-lines stop
   intercepting) and fade the drawing back, so the page beneath stays usable. Scoped
   to .ooo-svg so the control panel, which reports the state, stays legible. */
.ooo-layer[data-ooo-peek="on"] .ooo-svg { opacity: 0.25; }
.ooo-layer[data-ooo-peek="on"] .ooo-badge,
.ooo-layer[data-ooo-peek="on"] .ooo-hit--back { pointer-events: none; }

/* "Overlay" off hides the drawing + hit-lines but leaves the panel (the way back)
   in place; the renderer hides the on-page rings separately. */
.ooo-layer.ooo-hidden .ooo-svg { display: none; }

/* Control panel: a fixed-width card pinned to a corner, styled to match the demo
   chrome. It holds two identical on/off switches (overlay + click-through). Palette
   inlined: the overlay mounts on arbitrary pages and can't reach the demo's vars. */
.ooo-panel, .ooo-panel * { box-sizing: border-box; }
.ooo-panel { position: fixed; left: 12px; bottom: 12px; z-index: 1;
  width: 188px; pointer-events: auto; margin: 0; padding: 10px;
  display: flex; flex-direction: column; gap: 9px;
  background: #f5f4ef; border: 1px solid #c6c2b4; border-radius: 3px;
  box-shadow: 0 10px 30px -12px rgba(24, 25, 28, 0.32), 0 1px 2px rgba(24, 25, 28, 0.08);
  font: 500 12px/1 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
/* Title doubles as the collapse toggle: full-width button, +/- sign on the right
   tells which way it folds. Reset the UA button look back to the card's type. */
.ooo-panel-title { display: flex; align-items: center; width: 100%; margin: 0;
  padding: 0 0 9px; border: 0; border-bottom: 1px solid #dcd9cd; background: none;
  font: 600 13px/1 inherit; color: #18191c; letter-spacing: 0.01em;
  text-align: left; cursor: pointer; }
.ooo-panel-title::after { content: "\\2212"; margin-left: auto; padding-left: 12px;
  color: #74756d; font-size: 14px; }
.ooo-panel-title:hover { color: #000; }
.ooo-panel-title:hover::after { color: #18191c; }
.ooo-panel-body { display: flex; flex-direction: column; gap: 9px; }
/* Collapsed: fold the body away, leave the bare title bar (no divider, +/- flips). */
.ooo-panel[data-open="0"] .ooo-panel-title { padding-bottom: 0; border-bottom: 0; }
.ooo-panel[data-open="0"] .ooo-panel-title::after { content: "+"; }
.ooo-panel[data-open="0"] .ooo-panel-body { display: none; }
.ooo-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ooo-row-label { color: #34352d; }
/* Toggle switch: a pill track with a sliding knob; accent track + knob right when on. */
.ooo-switch { flex: none; position: relative; width: 32px; height: 18px; margin: 0; padding: 0;
  border: 1px solid #c6c2b4; border-radius: 999px; background: #e7e4da; cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease; }
.ooo-switch-knob { position: absolute; top: 1px; left: 1px; width: 14px; height: 14px;
  border-radius: 50%; background: #fffefb; box-shadow: 0 1px 2px rgba(24, 25, 28, 0.3);
  transition: transform 0.14s ease; }
.ooo-switch--on { background: #1f4e79; border-color: #1f4e79; }
.ooo-switch--on .ooo-switch-knob { transform: translateX(14px); }
.ooo-switch:disabled { cursor: default; opacity: 0.4; }
.ooo-panel-hint { margin: 1px 0 0; color: #74756d; font-size: 10.5px; letter-spacing: 0.01em; }
/* Copy findings: a plain action button (not a switch); hands the formatted report
   to the clipboard so it can be pasted into an AI chat. */
.ooo-copy { width: 100%; margin: 0; padding: 6px 8px; border: 1px solid #c6c2b4;
  border-radius: 3px; background: #ecebe4; color: #34352d;
  font: 600 11px/1 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.02em; cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease; }
.ooo-copy:hover { background: #e2e0d6; border-color: #b7b3a4; color: #18191c; }
.ooo-badge circle { fill: #fffefb; stroke: #2f6a47; stroke-width: 1.5;
  transform-box: fill-box; transform-origin: center; }
.ooo-badge text { fill: #2f6a47;
  font: 500 11px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
.ooo-badge--warn circle { stroke: #9a7d1a; }
.ooo-badge--warn text { fill: #9a7d1a; }
.ooo-badge--bad circle { stroke: #a01f17; }
.ooo-badge--bad text { fill: #a01f17; }
.ooo-badge--off text { font-size: 12px; }
.ooo-badge--on circle { fill: #2f6a47; stroke: #2f6a47; }
.ooo-badge--on text { fill: #fffefb; }
.ooo-badge--warn.ooo-badge--on circle { fill: #9a7d1a; stroke: #9a7d1a; }
.ooo-badge--bad.ooo-badge--on circle { fill: #a01f17; stroke: #a01f17; }

/* Autofocus indicator */
.ooo-af circle { fill: #1f4e79; stroke: #fffefb; stroke-width: 1.5; }
.ooo-af path { fill: #fffefb; }

.ooo-tip-cursor { position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; anchor-name: --ooo-tip-anchor; }


.ooo-tip { position: fixed; position-anchor: --ooo-tip-anchor;
  inset: auto; top: anchor(center); left: anchor(center); margin: 19px 0 0 -11px;
  position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  pointer-events: auto; width: max-content; max-width: 360px;
  background-color: #fffefb;
  background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>");
  color: #18191c; border: 1px solid #c6c2b4; border-radius: 2px;
  font: 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 18px 48px -14px rgba(24,25,28,0.34), 0 2px 5px rgba(24,25,28,0.08); }

.ooo-tip-head { display: flex; align-items: center; gap: 10px; padding: 9px 12px; }
.ooo-tip-idx { flex: none; align-self: stretch; display: flex; align-items: center;
  padding-right: 10px; border-right: 1px solid #dcd9cd;
  font: 500 14px/1 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: -0.01em; color: #1f4e79; }
.ooo-tip-idx--off { color: #9a7d1a; font-size: 15px; }
.ooo-tip-sel { min-width: 0; font: 12px/1.45 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #34352d; word-break: break-word; }

.ooo-tip-fields { margin: 0; padding: 8px 12px; border-top: 1px solid #dcd9cd;
  display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; align-items: baseline; }
.ooo-tip-fields dt { margin: 0;
  font: 600 9.5px/1.5 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.07em; text-transform: uppercase; color: #8a8b80; }
.ooo-tip-fields dd { margin: 0; min-width: 0; color: #34352d; font-size: 12.5px; word-break: break-word; }
.ooo-tip-mono { font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px; color: #18191c; }
.ooo-tip-dim { color: #b0b1a6; }

.ooo-tip-body { padding: 9px 12px; border-top: 1px solid #dcd9cd; }
.ooo-tip-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 9px; }
.ooo-tip-item { display: block; }
.ooo-tip-rule { display: flex; align-items: center; gap: 5px; width: fit-content; margin-bottom: 3px;
  font: 600 10px/1.4 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em; text-transform: uppercase; color: #a01f17; text-decoration: none; }
.ooo-tip-rule--warn { color: #9a7d1a; }
a.ooo-tip-rule:hover > span { text-decoration: underline; text-underline-offset: 2px; }
.ooo-tip-rule-ic { flex: none; opacity: 0.55; }
a.ooo-tip-rule:hover .ooo-tip-rule-ic { opacity: 1; }
.ooo-tip-msg { display: block; margin: 0; color: #34352d; font-size: 12.5px; }
.ooo-tip-ok { margin: 0; color: #1f7a44; font-size: 12.5px; }

/* hop tooltips reuse the frame without the index column */
.ooo-tip-flag { flex: none;
  font: 600 10px/1.4 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em; text-transform: uppercase; color: #1f7a44; }
.ooo-tip-flag--back { color: #a01f17; }
.ooo-tip-hop { font: 500 13px/1 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #18191c; }


/* Advance by exactly one dash period (7 + 6 = 13) per cycle so the marching dashes
   loop seamlessly. Must stay in sync with .ooo-seg's stroke-dasharray. */
@keyframes ooo-flow { to { stroke-dashoffset: -13; } }
@keyframes ooo-cast {
  0% { transform: scale(1); }
  35% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.ooo-layer[data-ooo-motion="play"] .ooo-seg { animation: ooo-flow 1.1s linear infinite; marker-mid: none; }
.ooo-layer[data-ooo-motion="play"] .ooo-seg--back { animation-duration: 0.8s; }
.ooo-layer[data-ooo-motion="play"] .ooo-badge--on circle { animation: ooo-cast 0.4s ease-out; }
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

/** Mirror just the ring rules into a shadow root (document styles don't cross
    the boundary), so a ringed element inside it still gets its outline. */
export function ensureRingStyles(root: ShadowRoot): void {
  adopt(root, ringSheet);
}
