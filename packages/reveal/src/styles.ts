// The `.fp-*` selectors in the CSS below are written out literally for
// readability; the class names the JS applies live in classes.ts and share its
// prefix, so they can't drift from this namespace.
export { RING_CLASS, RING_BAD_CLASS, RING_WARN_CLASS } from "./classes.js";

const RING_CSS = `
.fp-ring { outline: 1px dashed rgba(47, 106, 71, 0.5); outline-offset: 2px; }
.fp-ring--warn { outline: 1.5px dashed rgba(154, 125, 26, 0.8); outline-offset: 2px; }
.fp-ring--bad { outline: 1.5px solid rgba(160, 31, 23, 0.74); outline-offset: 2px; }
.fp-ring:focus-visible, .fp-ring--warn:focus-visible, .fp-ring--bad:focus-visible { outline: revert; }
`;

const OVERLAY_CSS = `
.fp-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.fp-svg { position: absolute; top: 0; left: 0; overflow: visible; }
.fp-seg { fill: none; stroke: #2f6a47; stroke-width: 2; opacity: 0.92;
  stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 7 6; }
.fp-seg--back { stroke: #a01f17; stroke-width: 2.25; }
.fp-hit { fill: none; stroke: transparent; stroke-width: 18; pointer-events: none; cursor: help; }
/* Only backward (red) hops are hoverable; forward (green) hops stay click-through. */
.fp-hit--back { pointer-events: stroke; }
${RING_CSS}
/* Badges read hollow by default (white fill, coloured outline and number), then
   fill in solid while their element is keyboard-focused, so the badge doubles as
   a "you are here" cursor that moves as you Tab. */
/* Every badge is hoverable (auto) so its tooltip opens on hover (the layer itself
   is pointer-events:none). The badge is a small disc at the element's centre, so
   it only intercepts clicks dead-centre. */
.fp-badge { pointer-events: auto; cursor: help; }
.fp-badge circle { fill: #fffefb; stroke: #2f6a47; stroke-width: 1.5;
  transform-box: fill-box; transform-origin: center; }
.fp-badge text { fill: #2f6a47;
  font: 500 11px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
.fp-badge--warn circle { stroke: #9a7d1a; }
.fp-badge--warn text { fill: #9a7d1a; }
.fp-badge--bad circle { stroke: #a01f17; }
.fp-badge--bad text { fill: #a01f17; }
.fp-badge--off text { font-size: 12px; }
.fp-badge--on circle { fill: #2f6a47; stroke: #2f6a47; }
.fp-badge--on text { fill: #fffefb; }
.fp-badge--warn.fp-badge--on circle { fill: #9a7d1a; stroke: #9a7d1a; }
.fp-badge--bad.fp-badge--on circle { fill: #a01f17; stroke: #a01f17; }

/* Autofocus indicator: a small informational (blue, never red) disc with a
   downward arrow at the badge corner, marking where focus lands on page load. */
.fp-af circle { fill: #1f4e79; stroke: #fffefb; stroke-width: 1.5; }
.fp-af path { fill: #fffefb; }

/* 0x0 point slid under the pointer; every tooltip anchors to it (see Tooltip),
   so showing one never writes to page DOM. */
.fp-tip-cursor { position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; anchor-name: --fp-tip-anchor; }

/* Spec-sheet index card, CSS-anchored to the cursor proxy (margin = badge radius
   11px + 8px gap, so it clears a badge) and flips at the viewport edge. Palette
   inlined: the overlay mounts on arbitrary pages. */
.fp-tip { position: fixed; position-anchor: --fp-tip-anchor;
  inset: auto; top: anchor(center); left: anchor(center); margin: 19px 0 0 -11px;
  position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  pointer-events: auto; width: max-content; max-width: 360px;
  background-color: #fffefb;
  background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>");
  color: #18191c; border: 1px solid #c6c2b4; border-radius: 2px;
  font: 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 18px 48px -14px rgba(24,25,28,0.34), 0 2px 5px rgba(24,25,28,0.08); }

.fp-tip-head { display: flex; align-items: center; gap: 10px; padding: 9px 12px; }
/* hanging index, split off by a full-height ledger hairline */
.fp-tip-idx { flex: none; align-self: stretch; display: flex; align-items: center;
  padding-right: 10px; border-right: 1px solid #dcd9cd;
  font: 500 14px/1 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: -0.01em; color: #1f4e79; }
.fp-tip-idx--off { color: #9a7d1a; font-size: 15px; }
/* selector titles the card; muted so the accent index leads the eye */
.fp-tip-sel { min-width: 0; font: 12px/1.45 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #34352d; word-break: break-word; }

/* two-column ledger: uppercase mono term, value on the right */
.fp-tip-fields { margin: 0; padding: 8px 12px; border-top: 1px solid #dcd9cd;
  display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; align-items: baseline; }
.fp-tip-fields dt { margin: 0;
  font: 600 9.5px/1.5 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.07em; text-transform: uppercase; color: #8a8b80; }
.fp-tip-fields dd { margin: 0; min-width: 0; color: #34352d; font-size: 12.5px; word-break: break-word; }
.fp-tip-mono { font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px; color: #18191c; }
.fp-tip-dim { color: #b0b1a6; }

.fp-tip-body { padding: 9px 12px; border-top: 1px solid #dcd9cd; }
.fp-tip-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 9px; }
.fp-tip-item { display: block; }
.fp-tip-rule { display: flex; align-items: center; gap: 5px; width: fit-content; margin-bottom: 3px;
  font: 600 10px/1.4 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em; text-transform: uppercase; color: #a01f17; text-decoration: none; }
.fp-tip-rule--warn { color: #9a7d1a; }
a.fp-tip-rule:hover > span { text-decoration: underline; text-underline-offset: 2px; }
.fp-tip-rule-ic { flex: none; opacity: 0.55; }
a.fp-tip-rule:hover .fp-tip-rule-ic { opacity: 1; }
.fp-tip-msg { display: block; margin: 0; color: #34352d; font-size: 12.5px; }
.fp-tip-ok { margin: 0; color: #1f7a44; font-size: 12.5px; }

/* hop tooltips reuse the frame without the index column */
.fp-tip-flag { flex: none;
  font: 600 10px/1.4 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em; text-transform: uppercase; color: #1f7a44; }
.fp-tip-flag--back { color: #a01f17; }
.fp-tip-hop { font: 500 13px/1 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #18191c; }


/* Advance by exactly one dash period (7 + 6 = 13) per cycle so the marching dashes
   loop seamlessly. Must stay in sync with .fp-seg's stroke-dasharray. */
@keyframes fp-flow { to { stroke-dashoffset: -13; } }
@keyframes fp-cast {
  0% { transform: scale(1); }
  35% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.fp-layer[data-fp-motion="play"] .fp-seg { animation: fp-flow 1.1s linear infinite; marker-mid: none; }
.fp-layer[data-fp-motion="play"] .fp-seg--back { animation-duration: 0.8s; }
.fp-layer[data-fp-motion="play"] .fp-badge--on circle { animation: fp-cast 0.4s ease-out; }
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
