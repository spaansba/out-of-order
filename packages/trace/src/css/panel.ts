// Control panel: a fixed-width card pinned to a corner, styled to match the demo
// chrome. It holds two identical on/off switches (overlay + click-through). Palette
// inlined: the overlay mounts on arbitrary pages and can't reach the demo's vars.
export const PANEL_CSS = `
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
`;
