export const TIP_CSS = `
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
.ooo-tip-list { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.ooo-tip-msg { display: block; margin: 0; color: var(--ooo-ink-2); font-size: 12.5px; }
.ooo-tip-ok { margin: 0; color: var(--ooo-ok-strong); font-size: 12.5px; }

/* hop tooltips reuse the frame without the index column */
.ooo-tip-flag { flex: none;
  font: 600 10px/1.4 var(--ooo-mono);
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--ooo-ok-strong); }
.ooo-tip-flag--back { color: var(--ooo-bad); }
.ooo-tip-hop { font: 500 13px/1 var(--ooo-mono);
  color: var(--ooo-ink); }
`;
