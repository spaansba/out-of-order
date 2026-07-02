import {
  selectorFor,
  isScreenReaderOnly,
  type AuditResult,
  type Issue,
  type Severity,
} from "@out-of-order/core";
import {
  computeAccessibleName,
  computeAccessibleDescription,
  getRole,
} from "dom-accessibility-api";
import type { StopSpec, SegSpec } from "./render.js";
import { badgeTip, segTip } from "./tip-content.js";

export interface DrawModel {
  stops: StopSpec[];
  segs: SegSpec[];
  offStops: StopSpec[];
}

/** Turn an analysis result into what the overlay draws: numbered tab stops, a
    hop between each consecutive pair, and ⊘ markers for flagged elements that
    aren't tab stops at all. Pure with respect to the overlay: reads the result
    (and, lazily, the DOM for tooltips) but touches no overlay state.

    `skipDrawing` marks elements to grade but not draw: the overlay's own panel is
    audited like any page content (its stops and any findings stay in the result),
    but badges, rings, and hops for it would scribble on the panel itself, half
    hidden under the card, so the drawing leaves it out. Numbers come from
    orderIndex, so the visible stops keep their true positions. */
export function buildDrawModel(
  result: AuditResult,
  skipDrawing: (element: Element) => boolean = () => false,
): DrawModel {
  const sequence = result.sequence.filter((entry) => !skipDrawing(entry.element));
  const issuesByElement = indexIssues(result);

  // Numbered tab stops.
  const stops: StopSpec[] = sequence.map((entry) =>
    makeStop(
      entry.element,
      entry.orderIndex + 1,
      entry.selector,
      entry.tabIndex,
      issuesByElement.get(entry.element) ?? [],
      true,
    ),
  );

  // A hop between each pair of consecutive stops. It's "backward" exactly when
  // its destination stop is flagged visual-order-mismatch, read once here, not
  // from live geometry, so the line's colour stays locked to the element's ring
  // (otherwise a sticky stop scrolling past would flip the line green↔red).
  const segs: SegSpec[] = [];
  for (let idx = 0; idx < sequence.length - 1; idx++) {
    const back = (issuesByElement.get(sequence[idx + 1]!.element) ?? []).some(
      (issue) => issue.rule === "visual-order-mismatch" && !issue.ignored,
    );
    segs.push({
      back,
      tip: () => segTip(back, sequence[idx]!.orderIndex + 1, sequence[idx + 1]!.orderIndex + 1),
    });
  }

  // Off-sequence markers: elements that violate a rule but aren't tab stops at
  // all (interactive-but-not-focusable). They get a ⊘ glyph, not a number.
  const inSeq = new Set(result.sequence.map((entry) => entry.element));
  const offStops: StopSpec[] = [];
  for (const [element, issues] of issuesByElement) {
    if (inSeq.has(element) || skipDrawing(element)) {
      continue;
    }
    // null number → ⊘ glyph; not a tab stop, so no tabindex/autofocus to show.
    offStops.push(makeStop(element, null, selectorFor(element), null, issues, false));
  }

  return { stops, segs, offStops };
}

// Index issues by element so a marker's tooltip can list every one. An issue
// also rings each of its relatedElements (controls sharing its root cause) red,
// without counting as a separate finding - see Issue.relatedElements.
function indexIssues(result: AuditResult): Map<Element, Issue[]> {
  const issuesByElement = new Map<Element, Issue[]>();
  const indexBy = (element: Element, issue: Issue): void => {
    const list = issuesByElement.get(element) ?? [];
    list.push(issue);
    issuesByElement.set(element, list);
  };
  for (const violation of result.violations) {
    for (const issue of violation.issues) {
      indexBy(violation.element, issue);
      for (const related of issue.relatedElements ?? []) {
        indexBy(related, issue);
      }
    }
  }
  return issuesByElement;
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

export function resultSignature(result: AuditResult): string {
  const order = result.sequence
    .map((entry) => `${elementId(entry.element)}@${entry.tabIndex}`)
    .join(">");
  const vios = result.violations
    .flatMap((violation) =>
      violation.issues.map((issue) => {
        const related = (issue.relatedElements ?? [])
          .map(elementId)
          .sort((a, b) => a - b)
          .join(",");
        return (
          `${elementId(violation.element)}:${issue.rule}${issue.ignored ? "!" : ""}` +
          (related ? `~${related}` : "")
        );
      }),
    )
    .sort()
    .join("|");
  return `${order}#${vios}`;
}

/** Build a badge spec for one element: its colour-driving severity and a tooltip.
    The dom-accessibility-api reads are the costliest part of a redraw and most
    badges are never hovered, so they run inside the tip thunk, not eagerly here. */
function makeStop(
  element: Element,
  num: number | null,
  selector: string,
  tabIndex: number | null,
  issues: Issue[],
  inSeq: boolean,
): StopSpec {
  const label = num !== null ? String(num) : "⊘";
  // autofocus marks where load-focus lands; moot for off-sequence (unfocusable) marks.
  const autofocus = inSeq && element.hasAttribute("autofocus");
  return {
    element,
    label,
    severity: worstSeverity(issues),
    inSeq,
    autofocus,
    tip: () =>
      badgeTip({
        num,
        selector,
        tabIndex,
        issues,
        name: computeAccessibleName(element).trim(),
        role: getRole(element) ?? "",
        description: computeAccessibleDescription(element).trim(),
        autofocus,
        srOnly: isScreenReaderOnly(element),
      }),
  };
}

/** The worst severity among an element's issues (error outranks warning), or
    null when it has none. Drives the badge/ring colour: one element, one colour,
    set by its most serious problem. Ignored (data-ooo-ignore) findings don't
    count, so an element whose only findings are approved reads as clean. */
function worstSeverity(issues: Issue[]): Severity | null {
  const live = issues.filter((issue) => !issue.ignored);
  if (live.some((issue) => issue.severity === "error")) {
    return "error";
  }
  return live.length ? "warning" : null;
}
