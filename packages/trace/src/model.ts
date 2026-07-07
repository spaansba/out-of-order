import {
  isScreenReaderOnly,
  flaggedEntries,
  selectorFor,
  type AuditResult,
  type Entry,
  type Issue,
  type Severity,
} from "@out-of-order/core";
import {
  computeAccessibleName,
  computeAccessibleDescription,
  getRole,
} from "dom-accessibility-api";
import type { StopSpec, SegmentSpec } from "./render.js";
import { badgeTip, segmentTip } from "./tip-content.js";

export interface DrawModel {
  stops: StopSpec[];
  segments: SegmentSpec[];
  offStops: StopSpec[];
}

/** Turn an analysis result into what the overlay draws: numbered tab stops, a
    hop between each consecutive pair, and ⊘ markers for flagged elements that
    aren't tab stops at all.  */
export function buildDrawModel(
  result: AuditResult,
  skipDrawing: (element: Element) => boolean = () => false,
): DrawModel {
  // audit already joins each element's own issues onto its entry; the only join
  // left is fanning an issue's relatedElements onto their entries so they ring
  // and tooltip red alongside the primary target.
  const borrowed = borrowedIssues(result);
  const issuesFor = (entry: Entry): Issue[] =>
    borrowed.has(entry.element) ? [...entry.issues, ...borrowed.get(entry.element)!] : entry.issues;

  const drawn = result.sequence.filter((entry) => !skipDrawing(entry.element));
  const stops = drawn.map((entry) => makeStop(entry, issuesFor(entry)));
  const offStops = result.offSequence
    .filter((entry) => !skipDrawing(entry.element))
    .map((entry) => makeStop(entry, issuesFor(entry)));

  // A hop between each pair of consecutive stops. It's "backward" exactly when
  // its destination stop is flagged visual-order-mismatch, read once here, not
  // from live geometry, so the line's colour stays locked to the element's ring
  // (otherwise a sticky stop scrolling past would flip the line green↔red).
  const segments: SegmentSpec[] = [];
  for (let idx = 0; idx < drawn.length - 1; idx++) {
    const to = drawn[idx + 1]!;
    const back = to.issues.some(
      (issue) => issue.rule === "visual-order-mismatch" && !issue.ignored,
    );
    segments.push({
      back,
      tip: () => segmentTip(back, drawn[idx]!.orderIndex! + 1, to.orderIndex! + 1),
    });
  }

  return { stops, segments, offStops };
}

// An issue rings each of its relatedElements (controls sharing its root cause)
// red, without counting as a separate finding - see Issue.relatedElements. Map
// each related element to the issues it rides along on, keeping them off the
// audit's own per-element issue lists.
function borrowedIssues(result: AuditResult): Map<Element, Issue[]> {
  const borrowed = new Map<Element, Issue[]>();
  for (const entry of [...result.sequence, ...result.offSequence]) {
    for (const issue of entry.issues) {
      for (const related of issue.relatedElements ?? []) {
        const list = borrowed.get(related) ?? [];
        list.push(issue);
        borrowed.set(related, list);
      }
    }
  }
  return borrowed;
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
  const vios = flaggedEntries(result)
    .flatMap((entry) =>
      entry.issues.map((issue) => {
        const related = (issue.relatedElements ?? [])
          .map(elementId)
          .sort((a, b) => a - b)
          .join(",");
        return (
          `${elementId(entry.element)}:${issue.rule}${issue.ignored ? "!" : ""}` +
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
function makeStop(entry: Entry, issues: Issue[]): StopSpec {
  const { element } = entry;
  const inSeq = entry.orderIndex !== undefined;
  const num = inSeq ? entry.orderIndex! + 1 : null;
  const label = num !== null ? String(num) : "⊘";
  // autofocus marks where load-focus lands; moot for off-sequence (unfocusable) marks.
  const autofocus = inSeq && element.hasAttribute("autofocus");
  return {
    element,
    floats: entry.floatRoot != null,
    label,
    severity: worstSeverity(issues),
    inSeq,
    autofocus,
    tip: () =>
      badgeTip({
        num,
        selector: selectorFor(element),
        tabIndex: entry.tabIndex ?? null,
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
