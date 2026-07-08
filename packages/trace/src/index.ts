import { audit, reportText, type AuditOptions, type AuditResult } from "@out-of-order/core";
import { ensureStyles } from "./styles.js";

export { ensureIssueStyles } from "./styles.js";
export { issueHtml, type RenderableIssue } from "./issue-html.js";
import { Tooltip } from "./tooltip.js";
import { Renderer } from "./render.js";
import { Mutations } from "./mutations.js";
import { buildDrawModel, resultSignature } from "./model.js";
import { headlessControls, setupControls, type ModifierKey } from "./controls.js";
import { loadPanelState, patchPanelState, type PanelState } from "./panel-state.js";
import { setupMotion, type MotionMode } from "./motion.js";
import { wirePageEvents } from "./page-events.js";
import { leadingThrottle, deepActiveElement } from "./util.js";

export type { MotionMode };

export const EXTENSION_ACTIVE_EVENT = "ooo:extension-active";
/** Fired by trace() at mount. A trace mounting after the extension attached
    would miss its announcement, so it asks; the extension answers with
    EXTENSION_ACTIVE_EVENT (synchronously) and the mount is skipped. */
export const TRACE_ACTIVE_EVENT = "ooo:trace-active";

export type { ModifierKey };
export {
  addCopySplit,
  addSwitch,
  listenForPeekKey,
  setSwitch,
  type CopySplitOptions,
} from "./controls.js";

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
  /** Mount the floating in-page control panel. Defaults to true. Turn it off
      when the host brings its own controls (e.g. the browser extension); the
      peek key keeps working. */
  controls?: boolean;
  /** Turn off this overlay for good when the browser extension announces
      itself (see EXTENSION_ACTIVE_EVENT). Defaults to true; the extension
      disables it on its own instance so it doesn't kill itself. */
  yieldToExtension?: boolean;
  /** Called after every re-analysis with the fresh result. The first call is
      synchronous, before trace() returns. */
  onResult?: (result: AuditResult) => void;
  /** Called whenever visibility or peek flips, whatever flipped it. */
  onStateChange?: (state: { visible: boolean; peeking: boolean }) => void;
}

export interface TraceHandle {
  /** Whether the overlay is currently shown. */
  readonly visible: boolean;
  readonly peeking: boolean;
  /** Show or hide the whole overlay: badges, arrows, and the element rings. */
  setVisible(visible: boolean): void;
  /** Flip between shown and hidden. */
  toggle(): void;
  /** Ignored while the overlay is hidden. */
  setPeek(peek: boolean): void;
  setMotion(mode: MotionMode): void;
  /** Remove the overlay layer, observers, and listeners. */
  destroy(): void;
  /** Latest analysis result, or null before the first draw. */
  result: AuditResult | null;
}

function createLayer(): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "ooo-layer";
  layer.dataset.oooPeek = "off";
  document.body.appendChild(layer);
  return layer;
}

/** What a killed trace hands back: mounting was skipped (or undone), every
    control is a no-op. */
function deadHandle(): TraceHandle {
  return {
    result: null,
    visible: false,
    peeking: false,
    setVisible: () => {},
    toggle: () => {},
    setPeek: () => {},
    setMotion: () => {},
    destroy: () => {},
  };
}

export function trace(options: TraceOptions = {}): TraceHandle {
  let live: TraceHandle | null = null;
  const yieldAc = new AbortController();
  if (options.yieldToExtension !== false) {
    let claimed = false;
    document.addEventListener(
      EXTENSION_ACTIVE_EVENT,
      () => {
        claimed = true;
        yieldAc.abort();
        live?.destroy();
      },
      { signal: yieldAc.signal },
    );
    document.dispatchEvent(new CustomEvent(TRACE_ACTIVE_EVENT));
    if (claimed) {
      return deadHandle();
    }
  }

  ensureStyles();

  const root = options.root ?? document;
  const layer = createLayer();
  const tooltip = new Tooltip(layer);
  const renderer = new Renderer(layer, tooltip);
  const motion = setupMotion(layer, options.motion ?? "auto");

  // don't re-run the full audit every frame.
  const { call: requestBuild, cancel: cancelBuild } = leadingThrottle(() => build(), 250);

  const mutations = new Mutations(layer, requestBuild);
  const teardownEvents = wirePageEvents(layer, renderer, requestBuild);

  // Skip the draw work when a mutation didn't change the verdict (positioning
  // is CSS-anchored, so only sequence/violation changes need a redraw).
  let lastSignature: string | null = null;

  const saved = loadPanelState();
  let visible = true;
  let peeking = false;

  const notifyState = (patch: Partial<PanelState>): void => {
    patchPanelState(patch);
    options.onStateChange?.({ visible, peeking });
  };

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
    notifyState({ visible: next });
  };
  const setPeek = (next: boolean): void => {
    peeking = next;
    layer.dataset.oooPeek = next ? "on" : "off";
    if (next) {
      tooltip.hide();
    }
    controls.syncPeek(next);
    notifyState({ peek: next });
  };

  const togglePeek = (): void => {
    if (visible) {
      setPeek(!peeking);
    }
  };

  const controls =
    options.controls === false
      ? headlessControls(options.peekKey ?? "Alt", togglePeek)
      : setupControls(layer, {
          peekKey: options.peekKey ?? "Alt",
          open: saved.open ?? true,
          copyFormat: saved.copyFormat ?? "by-element",
          onToggleVisible: () => setVisible(!visible),
          onTogglePeek: togglePeek,
          onToggleOpen: (open) => patchPanelState({ open }),
          onCopyFormat: (copyFormat) => patchPanelState({ copyFormat }),
          // handle.result is always set by the time the copy button can be clicked:
          // build() runs synchronously before trace() returns.
          getReport: (format) => reportText(handle.result ?? audit(root, options.audit), format),
        });

  // Replay the persisted state now the panel exists to mirror it. Peek is moot (and
  // disabled) while hidden, so only restore it when the overlay is shown.
  if (saved.visible === false) {
    setVisible(false);
  }
  if (saved.peek === true && visible) {
    setPeek(true);
  }

  let destroyed = false;
  const handle: TraceHandle = {
    result: null,
    get visible() {
      return visible;
    },
    get peeking() {
      return peeking;
    },
    setVisible,
    toggle: () => setVisible(!visible),

    setPeek: (peek) => {
      if (visible || !peek) {
        setPeek(peek);
      }
    },
    setMotion: (mode) => motion.setMode(mode),
    // Idempotent: the extension's takeover destroys the overlay out from under
    // the page, which may later call destroy() itself.
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      yieldAc.abort();
      motion.teardown();
      controls.teardown();
      cancelBuild();
      teardownEvents();
      mutations.destroy();
      tooltip.destroy();
      renderer.dispose();
      layer.remove();
    },
  };

  /** Re-analyze, turn the result into a draw model, and render it. */
  function build(): void {
    const result = audit(root, options.audit);

    // Shadow roots attached since the last pass must be watched too, or a later
    // mutation inside one would never trigger a re-analysis.
    mutations.observeShadows(root);

    handle.result = result;
    options.onResult?.(result);

    // Quick check if we can skip drawing because the violations didn't change.
    // The page may still have reflowed (that's often what triggered the build),
    // so the JS-owned geometry gets re-derived even when the drawing is kept.
    const signature = resultSignature(result);
    if (signature === lastSignature) {
      renderer.placeManual();
      return;
    }
    lastSignature = signature;

    // The overlay's own controls are graded like page content (they stay in the
    // result), but drawing their markers would scribble on the panel itself.
    const { stops, segments, offStops } = buildDrawModel(result, (element) =>
      layer.contains(element),
    );
    renderer.draw(stops, segments, offStops);
    // If focus already sits on a tab stop (e.g. a re-analyze mid-tabbing), fill it.
    renderer.setFocused(deepActiveElement());
  }

  build();
  mutations.observe(root);
  live = handle;
  return handle;
}
