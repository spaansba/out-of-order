import {
  audit,
  formatViolations,
  type AuditOptions,
  type Rule,
  type Severity,
  type AuditResult,
  type Violation,
} from "@out-of-order/core";
import {
  computeAccessibleName,
  computeAccessibleDescription,
  getRole,
} from "dom-accessibility-api";
import { ensureStyles } from "./styles.js";
import { Tooltip } from "./tooltip.js";
import { Renderer, type StopSpec, type SegSpec } from "./render.js";
import { Tracker } from "./track.js";
import { Mutations } from "./mutations.js";
import { badgeTip, segTip } from "./tip-content.js";
import { setupControls, loadPanelState, patchPanelState } from "./controls.js";

// Overlay users get the analyzer from this one package: re-export core's public
// API so trace() and audit()/formatViolations() come from a single
// import, without also depending on @out-of-order/core directly.
export * from "@out-of-order/core";

export type MotionMode = "auto" | "on" | "off";

export type ModifierKey = "Alt" | "Control" | "Shift" | "Meta";

export interface TraceOptions {
  /** Subtree to analyze. Defaults to document. */
  root?: ParentNode;
  /** Forwarded to audit (rule toggles). */
  audit?: AuditOptions;
  /** Extra custom rules, run alongside the built-ins on every analysis. */
  rules?: Rule[];
  /** Motion behaviour. Defaults to "auto". */
  motion?: MotionMode;
  /** Tap this modifier to toggle the overlay click-through ("peek" at the page
      beneath) without hiding it; tap again to restore. Defaults to "Alt". */
  peekKey?: ModifierKey;
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
  // Marks every node in this overlay so the analyzer's "is it covered?" check can
  // ignore our own badges/lines instead of mistaking them for an obscuring layer.
  layer.setAttribute("data-ooo-overlay", "");
  document.body.appendChild(layer);

  const motion = options.motion ?? "auto";
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyMotion = (): void => {
    const animate =
      motion === "on" || (motion === "auto" && !reduceQuery.matches);
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
    onToggleVisible: () => setVisible(!visible),
    // Peek does nothing with the overlay hidden, so ignore the toggle then.
    onTogglePeek: () => visible && setPeek(!peeking),
    onToggleOpen: (open) => patchPanelState({ open }),
    getReport: () => formatViolations(handle.result?.violations ?? []),
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
    const result = audit(
      options.root ?? document,
      options.audit,
      options.rules,
    );

    handle.result = result;

    // Nothing the overlay draws has changed, so skip the redraw and re-observe.
    const sig = resultSignature(result);
    if (sig === lastSig) {
      return;
    }
    lastSig = sig;

    const sequence = result.sequence;
    const inSeq = new Set(sequence.map((entry) => entry.element));

    // Group violations by element so a marker's tooltip can list every issue. A
    // violation also rings each of its relatedElements (controls sharing its root
    // cause) red, without counting as a separate finding - see Violation.relatedElements.
    const vById = new Map<Element, Violation[]>();
    const indexBy = (element: Element, violation: Violation): void => {
      const list = vById.get(element) ?? [];
      list.push(violation);
      vById.set(element, list);
    };
    for (const violation of result.violations) {
      indexBy(violation.element, violation);
      for (const related of violation.relatedElements ?? []) {
        indexBy(related, violation);
      }
    }

    // Numbered tab stops.
    const stops: StopSpec[] = sequence.map((entry, idx) =>
      makeStop(
        entry.element,
        String(idx + 1),
        idx + 1,
        entry.selector,
        entry.tabIndex,
        vById.get(entry.element) ?? [],
        true,
      ),
    );

    // A hop between each pair of consecutive stops. It's "backward" exactly when
    // its destination stop is flagged visual-order-mismatch, read once here, not
    // from live geometry, so the line's colour stays locked to the element's ring
    // (otherwise a sticky stop scrolling past would flip the line green↔red).
    const segs: SegSpec[] = [];
    for (let idx = 0; idx < sequence.length - 1; idx++) {
      const back = (vById.get(sequence[idx + 1]!.element) ?? []).some(
        (violation) => violation.rule === "visual-order-mismatch",
      );
      segs.push({ back, tip: () => segTip(back, idx + 1, idx + 2) });
    }

    // Off-sequence markers: elements that violate a rule but aren't tab stops at
    // all (interactive-but-not-focusable). They get a ⊘ glyph, not a number.
    const offStops: StopSpec[] = [];
    for (const [element, vios] of vById) {
      if (inSeq.has(element)) {
        continue;
      }
      // null number → ⊘ glyph; not a tab stop, so no tabindex/autofocus to show.
      offStops.push(
        makeStop(element, "⊘", null, vios[0]!.selector, null, vios, false),
      );
    }

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

// A stable per-element id. Keys the signature on element identity, not selector:
// repeated structures (a virtual list's recycled rows) share one selector, so a
// selector-keyed signature misses an element swap when the count is unchanged.
const elementIds = new WeakMap<Element, number>();
let nextElementId = 1;
function elementId(element: Element): number {
  let id = elementIds.get(element);
  if (id === undefined) {
    id = nextElementId++;
    elementIds.set(element, id);
  }
  return id;
}

// A stable string of everything the overlay renders: the ordered stops plus each
// element's rule ids. Same signature means a rebuild would draw the same thing.
// Geometry is excluded; the position tracker handles movement without a re-analyze.
function resultSignature(result: AuditResult): string {
  const order = result.sequence
    .map((entry) => elementId(entry.element))
    .join(">");
  const vios = result.violations
    .map((violation) => `${elementId(violation.element)}:${violation.rule}`)
    .sort()
    .join("|");
  return `${order}#${vios}`;
}

/** Build a badge spec for one element: its colour-driving severity and a tooltip.
    The dom-accessibility-api reads are the costliest part of a redraw and most
    badges are never hovered, so they run inside the tip thunk, not eagerly here. */
function makeStop(
  element: Element,
  label: string,
  num: number | null,
  selector: string,
  tabIndex: number | null,
  violations: Violation[],
  inSeq: boolean,
): StopSpec {
  // autofocus marks where load-focus lands; moot for off-sequence (unfocusable) marks.
  const autofocus = inSeq && element.hasAttribute("autofocus");
  return {
    element,
    label,
    severity: worstSeverity(violations),
    inSeq,
    autofocus,
    tip: () =>
      badgeTip({
        num,
        selector,
        tabIndex,
        violations,
        name: computeAccessibleName(element).trim(),
        role: getRole(element) ?? "",
        description: computeAccessibleDescription(element).trim(),
        autofocus,
      }),
  };
}

/** The worst severity among an element's findings (error outranks warning), or
    null when it has none. Drives the badge/ring colour: one element, one colour,
    set by its most serious problem. */
function worstSeverity(violations: Violation[]): Severity | null {
  if (violations.some((violation) => violation.severity === "error")) {
    return "error";
  }
  return violations.length ? "warning" : null;
}
