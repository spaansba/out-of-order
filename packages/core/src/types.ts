import type { ALL_RULES } from "./rules.js";

/** How serious a finding is. `error` marks a real barrier (a control is
    unreachable, unannounced, invisible, or trapped); `warning` marks dead/no-op
    markup or a best-practice nit that doesn't actually block anyone. */
export type Severity = "error" | "warning";

/** One rule's setting in {@link AnalyzeOptions.rules}. Omit a rule to keep its
    default (see `DEFAULT_SEVERITY`). Otherwise:
    - `"error"` / `"warning"` — enable the rule, graded at that severity;
    - `"off"` — disable the rule. */
export type RuleSetting = Severity | "off";

/** A single problem found with the tab order. */
export interface Violation {
  /** Stable rule identifier */
  rule: RuleId;
  /** How serious this finding is: the rule's default unless overridden via
      {@link AnalyzeOptions.rules}. */
  severity: Severity;
  /** Human-readable description of what's wrong. */
  message: string;
  /** Spec link for the rule (WCAG, WAI-ARIA, or ARIA APG); same across its violations. */
  docs: string;
  /** The offending element. */
  element: Element;
  /** A CSS-ish path to the element, for messages and logs. */
  selector: string;
  /** Position in the tab sequence, when the element is a tab stop. */
  orderIndex?: number;
  /** Other elements with the same root cause. Ringed alongside `element` but not
      reported as separate findings, so one missing fix doesn't become N violations. */
  relatedElements?: Element[];
}

export type RuleId = keyof typeof ALL_RULES;

/** One element in the computed tab sequence, with the data rules need. */
export interface SequenceEntry {
  element: Element;
  selector: string;
  /** Zero-based position in the tab sequence. */
  orderIndex: number;
  /** Resolved tabindex (0 if unset but focusable). */
  tabIndex: number;
  /** Bounding rect at analysis time (real layout, browser only). */
  rect: DOMRect;
}

export interface TabOrderResult {
  /** True when no enabled rule produced an `error`. Warnings are advisory and do
      not flip this; check `violations` if you need to surface them too. */
  valid: boolean;
  /** Elements in the exact order tabbing will reach them. */
  sequence: SequenceEntry[];
  /** All violations found, across all enabled rules (both severities). */
  violations: Violation[];
}

export interface AnalyzeOptions {
  /** Per-rule overrides. Every rule runs at its default severity unless listed
      here: set `"off"`/`false` to disable it, or `"error"`/`"warning"` to
      re-grade it (e.g. demote a noisy rule to a warning, or promote one to fail
      the build). See {@link RuleSetting}. */
  rules?: Partial<Record<RuleId, RuleSetting>>;
}
