import {
  analyzeTabOrder,
  type AnalyzeOptions,
  type Rule,
  type Severity,
  type TabOrderResult,
  type Violation,
} from "@focuspocus/core";
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

export type MotionMode = "auto" | "on" | "off";

export type ModifierKey = "Alt" | "Control" | "Shift" | "Meta";

export interface RevealOptions {
  /** Subtree to analyze. Defaults to document. */
  root?: ParentNode;
  /** Forwarded to analyzeTabOrder (rule toggles). */
  analyze?: AnalyzeOptions;
  /** Extra custom rules, run alongside the built-ins on every analysis. */
  rules?: Rule[];
  /** Motion behaviour. Defaults to "auto". */
  motion?: MotionMode;
  /** Tap this modifier to toggle the overlay click-through ("peek" at the page
      beneath) without hiding it; tap again to restore. Defaults to "Alt". */
  peekKey?: ModifierKey;
}

export interface RevealHandle {
  /** Whether the overlay is currently shown. */
  readonly visible: boolean;
  /** Show or hide the whole overlay: badges, arrows, and the element rings. */
  setVisible(visible: boolean): void;
  /** Flip between shown and hidden. */
  toggle(): void;
  /** Remove the overlay layer, observers, and listeners. */
  destroy(): void;
  /** Latest analysis result, or null before the first draw. */
  result: TabOrderResult | null;
}

export function reveal(options: RevealOptions = {}): RevealHandle {
  ensureStyles();

  const layer = document.createElement("div");
  layer.className = "fp-layer";
  // Marks every node in this overlay so the analyzer's "is it covered?" check can
  // ignore our own badges/lines instead of mistaking them for an obscuring layer.
  layer.setAttribute("data-focuspocus-overlay", "");
  document.body.appendChild(layer);

  const motion = options.motion ?? "auto";
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyMotion = (): void => {
    const animate =
      motion === "on" || (motion === "auto" && !reduceQuery.matches);
    layer.dataset.fpMotion = animate ? "play" : "still";
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

  let visible = true;
  let syncControls: (shown: boolean) => void = () => {};
  const setVisible = (next: boolean): void => {
    visible = next;
    // Hide only the drawing (badges + arrows) and the rings; the control panel
    // shares this layer and must survive so "Show overlay" stays reachable.
    layer.classList.toggle("fp-hidden", !next);
    renderer.setRingsVisible(next);
    syncControls(next);
  };

  // The panel owns both controls (peek + show/hide); it reports visibility back
  // through syncControls so its button label tracks programmatic setVisible too.
  const controls = setupControls(layer, tooltip, options.peekKey ?? "Alt", () =>
    setVisible(!visible),
  );
  syncControls = controls.syncVisible;

  const handle: RevealHandle = {
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
    const result = analyzeTabOrder(
      options.root ?? document,
      options.analyze,
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

const PEEK_KEY_LABEL: Record<ModifierKey, string> = {
  Alt: "Alt",
  Control: "Ctrl",
  Shift: "Shift",
  Meta: "Meta",
};

interface Controls {
  /** Update the show/hide button to match the overlay's current visibility. */
  syncVisible(shown: boolean): void;
  /** Drop every listener and remove the panel. */
  teardown(): void;
}

function setupControls(
  layer: HTMLElement,
  tooltip: Tooltip,
  peekKey: ModifierKey,
  onToggleVisible: () => void,
): Controls {
  const abort = new AbortController();
  const signal = abort.signal;
  const label = PEEK_KEY_LABEL[peekKey];

  // Native <button>s so the analyzer leaves them alone; tabindex=-1 keeps the
  // panel out of the very tab order it's measuring (the peek modifier is the
  // keyboard path in). Styled to match the demo chrome (see styles.ts).
  const panel = document.createElement("div");
  panel.className = "fp-panel";
  panel.dataset.open = "1";

  const button = (cls: string, parent: HTMLElement): HTMLButtonElement => {
    const el = document.createElement("button");
    el.type = "button";
    el.tabIndex = -1;
    el.className = cls;
    // Swallow mousedown so a click never steals focus from the inspected control.
    el.addEventListener("mousedown", (event) => event.preventDefault(), { signal });
    parent.appendChild(el);
    return el;
  };

  // Collapsible header: clicking it folds the panel down to just this bar, so it
  // can be tucked out of the way without losing the controls.
  const head = button("fp-panel-head", panel);
  head.innerHTML = `Focus Pocus<span class="fp-panel-chev" aria-hidden="true"></span>`;
  head.addEventListener(
    "click",
    () => (panel.dataset.open = panel.dataset.open === "1" ? "0" : "1"),
    { signal },
  );

  const body = document.createElement("div");
  body.className = "fp-panel-body";
  panel.appendChild(body);

  // Fixed-width labels: the button text doesn't grow the panel (CSS pins the
  // width); colour, not length, carries the state - both buttons light up accent
  // when they sit in their non-default position (hidden / peeking).
  const visBtn = button("fp-panel-btn fp-panel-vis", body);
  visBtn.textContent = "Hide overlay";
  visBtn.addEventListener("click", onToggleVisible, { signal });

  const peekBtn = button("fp-panel-btn fp-panel-peek", body);
  let peeking = false;
  const setPeek = (next: boolean): void => {
    peeking = next;
    layer.dataset.fpPeek = next ? "on" : "off";
    peekBtn.classList.toggle("fp-panel-btn--on", next);
    peekBtn.textContent = next ? "Click-through on" : "Click through";
    if (next) {
      tooltip.hide();
    }
  };
  setPeek(false);
  peekBtn.addEventListener("click", () => setPeek(!peeking), { signal });

  const hint = document.createElement("p");
  hint.className = "fp-panel-hint";
  hint.textContent = `tap ${label} to peek`;
  body.appendChild(hint);

  layer.appendChild(panel);

  // A "lone tap" of the modifier toggles peek: armed when it goes down by itself,
  // disarmed the moment any other key or a click joins in (so combos like Alt+Tab,
  // Ctrl+C, or a hold-and-click never toggle), fired on its release.
  let armed = false;
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== peekKey) {
        armed = false;
      } else if (!event.repeat) {
        armed = true;
      }
    },
    { signal },
  );

  window.addEventListener(
    "keyup",
    (event) => {
      if (event.key !== peekKey || !armed) {
        return;
      }
      armed = false;
      setPeek(!peeking);
    },
    { signal },
  );

  window.addEventListener("pointerdown", () => (armed = false), { signal });
  window.addEventListener("blur", () => (armed = false), { signal });

  return {
    syncVisible: (shown) => {
      visBtn.textContent = shown ? "Hide overlay" : "Show overlay";
      // Accent the button while hidden (its non-default state), matching how the
      // peek button lights up while click-through is on.
      visBtn.classList.toggle("fp-panel-btn--on", !shown);
      // Peek is meaningless with nothing drawn, so disable it while hidden.
      peekBtn.disabled = !shown;
    },
    teardown: () => {
      abort.abort();
      panel.remove();
    },
  };
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
function resultSignature(result: TabOrderResult): string {
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
