import type { Rule, RuleId, Severity } from "./rules/index.js";

export type RuleOverride = Severity | "off";

type AnyRuleId = RuleId | (string & {});

/** A single rule failure on one element. */
export interface Issue {
  /** Stable rule identifier. */
  rule: AnyRuleId;
  /** How serious this finding is. */
  severity: Severity;
  /** Human-readable description of what's wrong. */
  message: string;
  /** Suggested remediation, when the rule has one. */
  fix?: string;
  /** Spec link for the rule (WCAG, WAI-ARIA, or ARIA APG). */
  docs?: string;
  /** Other elements sharing this issue's root cause. */
  relatedElements?: Element[];
  /** Approved (silenced) by a `data-ooo-ignore` on the element */
  ignored?: boolean;
}

/** One graded element */
export interface Entry {
  element: Element;
  issues: Issue[];
  /** Zero-based position in the tab sequence, when the element is a tab stop. */
  orderIndex?: number;
  /** Resolved tabindex, when the element is a tab stop. */
  tabIndex?: number;
  /** Bounding rect at analysis time, when the element is a tab stop. */
  rect?: DOMRect;
  /** The fixed/sticky ancestor-or-self the element rides in, or null in flow. */
  floatRoot?: Element | null;
}

export interface AuditResult {
  /** True when no enabled rule produced an `error` severity finding. */
  valid: boolean;
  /** Every tab stop in the exact order tabbing reaches them, each carrying its
      issues */
  sequence: Entry[];
  /** Flagged elements that aren't tab stops at all (interactive but not
      focusable); each always carries at least one issue. */
  offSequence: Entry[];
}

export interface AuditOptions {
  /** Per-rule overrides. Every rule runs at its default severity unless listed
      here: set `"off"` to disable it, or `"error"`/`"warning"` to
      re-grade it. See {@link RuleOverride}. */
  rules?: Partial<Record<RuleId, RuleOverride>>;
  /** Extra rules, run alongside the built-ins. Overridable via `rules` like any
      built-in. */
  customRules?: Rule[];
}
