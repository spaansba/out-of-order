import type { DomReads } from "../dom/reads.js";

export type Severity = "error" | "warning";

export interface SequenceEntry {
  element: Element;
  /** Zero-based position in the tab sequence. */
  orderIndex: number;
  /** Resolved tabindex (0 if unset but focusable). */
  tabIndex: number;
  /** Bounding rect at analysis time (real layout, browser only). */
  rect: DOMRect;
  /** The fixed/sticky ancestor-or-self the element rides in, or null when it
      sits in normal flow */
  floatRoot: Element | null;
}

/** Everything a rule may need beyond the sequence itself. */
interface RuleContext {
  /** The analyzed root element (lets rules look beyond the tab sequence). */
  container: Element;
  inSequence: Set<Element>;
  reads: DomReads;
}

/** One problem a rule reports, before grading. */
export interface Finding {
  /** Human-readable description of what's wrong. */
  message: string;
  /** Suggested remediation. */
  fix?: string;
  /** The element the finding points at. A {@link SequenceEntry} when it is a tab
      stop (carries orderIndex), or a bare Element when it is not. */
  target: SequenceEntry | Element;
  /** Other elements with the same root cause. Ringed alongside `target` but not
      reported as separate findings, so one missing fix doesn't become N violations. */
  relatedElements?: Element[];
}

/** Takes the tab sequence (plus context) and returns any findings. Pure. */
export type RuleRun = (sequence: SequenceEntry[], ctx: RuleContext) => Finding[];

export interface Rule {
  /** Stable rule identifier, surfaced on every issue it produces. */
  id: string;
  /** Spec link the rule is grounded in (WCAG, WAI-ARIA, or ARIA APG). */
  docs?: string;
  /** Severity the rule fires at unless overridden via `AuditOptions.rules`. */
  severity: Severity;
  run: RuleRun;
}

/** A rule minus its id, which the registry key supplies. */
export type RuleDef = Omit<Rule, "id">;

/** Map the tab sequence to at most one finding per entry: return a message (plus
    optional fix) to flag the entry, or null to pass it. Collapses the boilerplate
    of the per-entry rules. */
export const flagEntries = (
  sequence: SequenceEntry[],
  flag: (entry: SequenceEntry) => string | Pick<Finding, "message" | "fix"> | null,
): Finding[] =>
  sequence.flatMap((entry) => {
    const found = flag(entry);
    if (!found) {
      return [];
    }
    return typeof found === "string"
      ? [{ message: found, target: entry }]
      : [{ ...found, target: entry }];
  });
