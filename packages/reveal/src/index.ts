import {
  analyzeTabOrder,
  type AnalyzeOptions,
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

export type MotionMode = "auto" | "on" | "off";

export interface RevealOptions {
  /** Subtree to analyze. Defaults to document. */
  root?: ParentNode;
  /** Forwarded to analyzeTabOrder (rule toggles). */
  analyze?: AnalyzeOptions;
  /** A subtree to skip (no badges/rings), e.g. because another overlay owns it, so
      a region the main overlay also analyzes isn't numbered twice. */
  exclude?: Element | null;
  /** Motion behaviour. Defaults to "auto". */
  motion?: MotionMode;
}

export interface RevealHandle {
  /** Re-run the analysis and redraw. Call after the DOM changes. */
  refresh(): void;
  /** Re-read every marker's rect and redraw (without re-analyzing). */
  reposition(): void;
  /** Show or hide the overlay layer. */
  setVisible(visible: boolean): void;
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

  const handle: RevealHandle = {
    result: null,
    refresh: () => build(),
    reposition: () => renderer.seed(),
    setVisible: (visible) => {
      layer.style.display = visible ? "" : "none";
    },
    destroy: () => {
      if (motion === "auto") {
        reduceQuery.removeEventListener("change", applyMotion);
      }
      tracker.destroy();
      mutations.destroy();
      tooltip.destroy();
      renderer.clear();
      layer.remove();
    },
  };

  /** Re-analyze, turn the result into a draw model, render it, and (re)observe. */
  function build(): void {
    const result = analyzeTabOrder(options.root ?? document, options.analyze, [
      (sequence) => {
        console.log(sequence);

        return [
          {
            rule: "custom-rule",
            message: "This is a custom rule violation.",
            docs: "https://example.com/custom-rule-docs",
            element: sequence[0]?.element ?? document.body,
            selector: sequence[0]?.selector ?? "",
          },
        ];
      },
    ]);

    handle.result = result;

    // Nothing the overlay draws has changed, so skip the redraw and re-observe.
    const sig = resultSignature(result);
    if (sig === lastSig) {
      return;
    }
    lastSig = sig;

    // Skip a subtree owned by another overlay (so it isn't numbered twice).
    const excludeEl = options.exclude ?? null;
    const excluded = (element: Element): boolean =>
      !!excludeEl && (element === excludeEl || excludeEl.contains(element));

    const sequence = result.sequence.filter(
      (entry) => !excluded(entry.element),
    );
    const inSeq = new Set(sequence.map((entry) => entry.element));

    // Group violations by element so a marker's tooltip can list every issue. A
    // violation also rings each of its relatedElements (controls sharing its root
    // cause) red, without counting as a separate finding - see Violation.relatedElements.
    const vById = new Map<Element, Violation[]>();
    const indexBy = (element: Element, violation: Violation): void => {
      if (excluded(element)) {
        return;
      }
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
    const stops: StopSpec[] = sequence.map((entry, idx) => {
      const vios = vById.get(entry.element) ?? [];
      const autofocus = entry.element.hasAttribute("autofocus");
      return {
        element: entry.element,
        label: String(idx + 1),
        severity: worstSeverity(vios),
        inSeq: true,
        autofocus,
        // Built on hover: the dom-accessibility-api reads below are the costliest
        // part of a redraw, and most badges are never hovered.
        tip: () =>
          badgeTip(
            idx + 1,
            entry.selector,
            entry.tabIndex,
            vios,
            computeAccessibleName(entry.element).trim(),
            getRole(entry.element) ?? "",
            computeAccessibleDescription(entry.element).trim(),
            autofocus,
          ),
      };
    });

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
      offStops.push({
        element,
        label: "⊘",
        severity: worstSeverity(vios),
        inSeq: false,
        // Off-sequence elements aren't focusable, so autofocus is moot here.
        autofocus: false,
        tip: () =>
          badgeTip(
            null,
            vios[0]!.selector,
            null,
            vios,
            computeAccessibleName(element).trim(),
            getRole(element) ?? "",
            computeAccessibleDescription(element).trim(),
            false,
          ),
      });
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

function badgeTip(
  num: number | null,
  selector: string,
  tabIndex: number | null,
  violations: Violation[],
  name: string,
  role: string,
  description: string,
  autofocus: boolean,
): string {
  // Stop number, or ⊘ for an off-sequence (interactive-but-unreachable) marker.
  const idx =
    num !== null
      ? `<span class="fp-tip-idx">${num}</span>`
      : `<span class="fp-tip-idx fp-tip-idx--off">⊘</span>`;

  // A labelled ledger of what the screen reader sees: accessible name, role, the
  // optional description, and the tabindex. Name/role always show (— when absent);
  // the usually-empty description and a non-default tabindex appear only when set.
  const fields =
    field("name", name ? escapeHtml(name) : null) +
    field(
      "role",
      role ? `<span class="fp-tip-mono">${escapeHtml(role)}</span>` : null,
    ) +
    (description ? field("description", escapeHtml(description)) : "") +
    (tabIndex && tabIndex !== 0
      ? field("tabindex", `<span class="fp-tip-mono">${tabIndex}</span>`)
      : "") +
    // Informational, not a finding: this is where focus lands on page load.
    (autofocus
      ? field("autofocus", `<span class="fp-tip-mono">yes</span>`)
      : "");

  const body = violations.length
    ? `<ul class="fp-tip-list">${violations
        .map(
          (violation) =>
            `<li class="fp-tip-item">${ruleLabel(violation)}` +
            `<span class="fp-tip-msg">${escapeHtml(stripSelectorPrefix(violation.message))}</span></li>`,
        )
        .join("")}</ul>`
    : `<p class="fp-tip-ok">No issues found.</p>`;
  return (
    `<div class="fp-tip-head">${idx}<code class="fp-tip-sel">${escapeHtml(selector)}</code></div>` +
    `<dl class="fp-tip-fields">${fields}</dl>` +
    `<div class="fp-tip-body">${body}</div>`
  );
}

// One ledger row (term + value). A null value renders a muted em dash, so a missing
// accessible name or role reads as "absent" rather than silently dropping the row.
function field(key: string, value: string | null): string {
  return `<dt>${key}</dt><dd>${value ?? `<span class="fp-tip-dim">—</span>`}</dd>`;
}

// "Open in new tab" glyph, inherits the rule's colour via currentColor.
const EXTERNAL_ICON =
  `<svg class="fp-tip-rule-ic" viewBox="0 0 24 24" width="11" height="11" fill="none" ` +
  `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>` +
  `<path d="M15 4h5v5"/><path d="M20 4l-9 9"/></svg>`;

// The rule id, linked to its spec doc when one is known (always, in practice).
// tabindex="-1": the tooltip is a hover-only, invoker-less popover, so a keyboard
// user can never open it to reach the link anyway. Keeping it out of the tab order
// stops the analyzer (which reads the live DOM) from numbering it as a stray stop.
function ruleLabel(violation: Violation): string {
  // Amber for warnings, red (the default) for errors, matching badge and ring.
  const cls =
    violation.severity === "warning"
      ? "fp-tip-rule fp-tip-rule--warn"
      : "fp-tip-rule";
  if (!violation.docs) {
    return `<span class="${cls}">${violation.rule}</span>`;
  }
  return (
    `<a class="${cls}" href="${escapeHtml(violation.docs)}" target="_blank" rel="noreferrer" tabindex="-1">` +
    `<span>${violation.rule}</span>${EXTERNAL_ICON}</a>`
  );
}

/** The worst severity among an element's findings (error outranks warning), or
    null when it has none. Drives the badge/ring colour: one element, one colour,
    set by its most serious problem. */
function worstSeverity(violations: Violation[]): Severity | null {
  let worst: Severity | null = null;
  for (const violation of violations) {
    if (violation.severity === "error") {
      return "error";
    }
    worst = "warning";
  }
  return worst;
}

/** Tooltip for a hop between stops #from and #to. */
function segTip(back: boolean, from: number, toStop: number): string {
  const flag = back
    ? `<span class="fp-tip-flag fp-tip-flag--back">↩ reverse</span>`
    : `<span class="fp-tip-flag">→ forward</span>`;
  const message = back
    ? "Focus moves against the reading order — up, or right-to-left."
    : "Forward in reading order.";
  return (
    `<div class="fp-tip-head">${flag}<span class="fp-tip-hop">#${from} → #${toStop}</span></div>` +
    `<div class="fp-tip-body"><p class="fp-tip-msg">${message}</p></div>`
  );
}

/** Messages start with the selector for log/test use; the tooltip already shows
    it in the header, so trim a leading `"selector" ` to avoid repeating it. */
function stripSelectorPrefix(message: string): string {
  return message.replace(/^"[^"]*"\s*/, "");
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
}
