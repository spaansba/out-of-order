import {
  audit,
  formatViolations,
  type AuditFormat,
  type AuditOptions,
  type AuditResult,
} from "@out-of-order/core";
import { ensureStyles } from "./styles.js";
import { Tooltip } from "./tooltip.js";
import { Renderer } from "./render.js";
import { Tracker } from "./track.js";
import { Mutations } from "./mutations.js";
import { buildDrawModel, resultSignature } from "./model.js";
import { setupControls, type ModifierKey } from "./controls.js";

export type MotionMode = "auto" | "on" | "off";

export type { ModifierKey };

export interface TraceOptions {
  /** Subtree to analyze. Defaults to document. */
  root?: Document | Element;
  /** Forwarded to audit (rule toggles and custom rules). */
  audit?: AuditOptions;
  /** Motion behaviour. Defaults to "auto". */
  motion?: MotionMode;
  /** Tap this modifier to toggle the overlay click-through ("peek" at the page
      beneath) without hiding it; tap again to restore. Defaults to "Alt". */
  peekKey?: ModifierKey;
  /** Called after every re-analysis with the fresh result. The first call is
      synchronous, before trace() returns. */
  onResult?: (result: AuditResult) => void;
}

export interface TraceHandle {
  /** Whether the overlay is currently shown. */
  readonly visible: boolean;
  /** Show or hide the whole overlay: badges, arrows, and the element rings. */
  setVisible(visible: boolean): void;
  /** Flip between shown and hidden. */
  toggle(): void;
  /** Remove the overlay layer, observers, and listeners. */
  destroy(): void;
  /** Latest analysis result, or null before the first draw. */
  result: AuditResult | null;
}

export function trace(options: TraceOptions = {}): TraceHandle {
  ensureStyles();

  const layer = document.createElement("div");
  layer.className = "ooo-layer";
  layer.dataset.oooPeek = "off";
  document.body.appendChild(layer);

  const motion = options.motion ?? "auto";
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyMotion = (): void => {
    const animate = motion === "on" || (motion === "auto" && !reduceQuery.matches);
    layer.dataset.oooMotion = animate ? "play" : "still";
  };
  applyMotion();
  if (motion === "auto") {
    reduceQuery.addEventListener("change", applyMotion);
  }

  const tooltip = new Tooltip(layer);

  const renderer = new Renderer(layer, tooltip);
  const tracker = new Tracker({
    onMoved: (moved) => renderer.applyMoved(moved),
    onScroll: () => renderer.seed(),
    onResize: () => build(),
    onFocus: (element) => renderer.setFocused(element),
  });
  // Re-analyze when the page's DOM changes; `layer` is passed so the observer
  // ignores our own badge writes (which would otherwise loop forever).
  const mutations = new Mutations(layer, () => build());

  // Skip the draw work when a mutation didn't change the verdict (geometry is
  // tracked separately, so only sequence/violation changes need a redraw).
  let lastSig: string | null = null;

  // trace() owns both pieces of overlay state and all their side effects; the
  // panel is pure UI that flips them through callbacks and mirrors them through the
  // sync* methods. That keeps the two controls symmetric and the tooltip-hiding in
  // one place (any change that removes hoverable badges closes an open tooltip).
  // State is persisted per-tab so it survives a same-tab page navigation: the docs
  // site is multi-page, so without this a nav-link click would reset peek/hide.
  const saved = loadPanelState();
  let visible = true;
  let peeking = false;
  const setVisible = (next: boolean): void => {
    visible = next;
    // Hide only the drawing (badges + arrows) and the rings; the control panel
    // shares this layer and must survive so the overlay can be shown again.
    layer.classList.toggle("ooo-hidden", !next);
    renderer.setRingsVisible(next);
    if (!next) {
      tooltip.hide();
      if (peeking) {
        setPeek(false);
      }
    }
    controls.syncVisible(next);
    patchPanelState({ visible: next });
  };
  const setPeek = (next: boolean): void => {
    peeking = next;
    layer.dataset.oooPeek = next ? "on" : "off";
    if (next) {
      tooltip.hide();
    }
    controls.syncPeek(next);
    patchPanelState({ peek: next });
  };

  const controls = setupControls(layer, {
    peekKey: options.peekKey ?? "Alt",
    open: saved.open ?? true,
    copyFormat: saved.copyFormat ?? "by-element",
    onToggleVisible: () => setVisible(!visible),
    // Peek does nothing with the overlay hidden, so ignore the toggle then.
    onTogglePeek: () => visible && setPeek(!peeking),
    onToggleOpen: (open) => patchPanelState({ open }),
    onCopyFormat: (copyFormat) => patchPanelState({ copyFormat }),
    // handle.result is always set by the time the copy button can be clicked:
    // build() runs synchronously before trace() returns.
    getReport: (format) => {
      const result = handle.result ?? audit(options.root ?? document, options.audit);
      const report = formatViolations(result, format);
      return typeof report === "string" ? report : JSON.stringify(report, null, 2);
    },
  });

  // Replay the persisted state now the panel exists to mirror it. Peek is moot (and
  // disabled) while hidden, so only restore it when the overlay is shown.
  if (saved.visible === false) {
    setVisible(false);
  }
  if (saved.peek === true && visible) {
    setPeek(true);
  }

  const handle: TraceHandle = {
    result: null,
    get visible() {
      return visible;
    },
    setVisible,
    toggle: () => setVisible(!visible),
    destroy: () => {
      if (motion === "auto") {
        reduceQuery.removeEventListener("change", applyMotion);
      }
      controls.teardown();
      tracker.destroy();
      mutations.destroy();
      tooltip.destroy();
      renderer.clear();
      layer.remove();
    },
  };

  /** Re-analyze, turn the result into a draw model, render it, and (re)observe. */
  function build(): void {
    const result = audit(options.root ?? document, options.audit);

    // Shadow roots attached since the last pass must be watched too, or a later
    // mutation inside one would never trigger a re-analysis.
    mutations.observeShadows(options.root ?? document);

    handle.result = result;
    options.onResult?.(result);

    // Nothing the overlay draws has changed, so skip the redraw and re-observe.
    const sig = resultSignature(result);
    if (sig === lastSig) {
      return;
    }
    lastSig = sig;

    // The overlay's own controls are graded like page content (they stay in the
    // result), but drawing their markers would scribble on the panel itself.
    const { stops, segs, offStops } = buildDrawModel(result, (element) => layer.contains(element));
    renderer.draw(stops, segs, offStops);
    renderer.seed();
    tracker.observe(renderer.elementsToObserve());
    // If focus already sits on a tab stop (e.g. a re-analyze mid-tabbing), fill it.
    renderer.setFocused(document.activeElement);
  }

  build();
  tracker.listen();
  mutations.observe(options.root ?? document);
  return handle;
}

const PANEL_STATE_KEY = "ooo:trace";

interface PanelState {
  visible: boolean;
  peek: boolean;
  open: boolean;
  copyFormat: AuditFormat;
}

function loadPanelState(): Partial<PanelState> {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(PANEL_STATE_KEY) ?? "{}");
    return saved !== null && typeof saved === "object" ? (saved as Partial<PanelState>) : {};
  } catch {
    return {};
  }
}

function patchPanelState(patch: Partial<PanelState>): void {
  try {
    sessionStorage.setItem(PANEL_STATE_KEY, JSON.stringify({ ...loadPanelState(), ...patch }));
  } catch {}
}
