import type { ALL_RULES } from "./rules.js";

export type Severity = "error" | "warning";

export type RuleOverride = Severity | "off";

/** Serialized shape `audit` returns when asked to format its result: the findings
    grouped by element, grouped by rule, flat, or as a human-readable text block. */
export type AuditFormat = "by-element" | "by-rule" | "flat" | "text";

/** A single rule failure on one element. */
export interface Issue {
  /** Stable rule identifier. */
  rule: RuleId | (string & {});
  /** How serious this finding is. */
  severity: Severity;
  /** Human-readable description of what's wrong. */
  message: string;
  /** Spec link for the rule (WCAG, WAI-ARIA, or ARIA APG). */
  docs?: string;
  /** Other elements sharing this issue's root cause. */
  relatedElements?: Element[];
}

/** One offending element and every rule it failed. */
export interface Violation {
  /** The offending element. */
  element: Element;
  /** A CSS-ish path to the element, for messages and logs. */
  selector: string;
  /** Position in the tab sequence, when the element is a tab stop. */
  orderIndex?: number;
  /** The rules this element failed. */
  issues: Issue[];
}

/** A rule failure with its element references flattened to selector strings, so it
    survives serialization (e.g. `JSON.stringify`) unlike {@link Issue}, which holds
    live `Element`s. The issue shape shared by the formatted views. */
export interface SerializedIssue {
  rule: RuleId | (string & {});
  severity: Severity;
  message: string;
  docs?: string;
  /** Selectors of the elements sharing this issue's root cause. */
  related?: string[];
}

/** `"by-element"` format: one entry per offending element, its issues nested. The
    serializable twin of {@link Violation}. */
export interface ByElement {
  selector: string;
  orderIndex?: number;
  /** How many issues this element failed (`issues.length`). */
  issueCount: number;
  issues: SerializedIssue[];
}

/** `"by-rule"` format: one entry per failed rule, listing every element that hit it. */
export interface ByRule {
  rule: RuleId | (string & {});
  severity: Severity;
  docs?: string;
  /** How many elements failed this rule (`elements.length`). */
  issueCount: number;
  elements: {
    selector: string;
    orderIndex?: number;
    message: string;
    related?: string[];
  }[];
}

/** `"flat"` format: one row per (element, rule) pair, nothing nested. */
export interface Flat {
  rule: RuleId | (string & {});
  severity: Severity;
  selector: string;
  orderIndex?: number;
  message: string;
  docs?: string;
  related?: string[];
}

/** The type of {@link AuditResult.violations} for a given `format`: a string for
    `"text"`, the matching structured array for the others. */
export type Formatted<F extends AuditFormat> = F extends "text"
  ? string
  : F extends "by-element"
    ? ByElement[]
    : F extends "by-rule"
      ? ByRule[]
      : F extends "flat"
        ? Flat[]
        : never;

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

export interface AuditResult<V = Violation[]> {
  /** True when no enabled rule produced an `error`. Warnings are advisory and do
      not flip this; check `violations` if you need to surface them too. */
  valid: boolean;
  /** Elements in the exact order tabbing will reach them. */
  sequence: SequenceEntry[];
  /** One entry per offending element, each carrying its failed rules. When
      `AuditOptions.format` is set these same findings are reshaped to that view:
      a string for `"text"`, else a {@link Formatted} array. */
  violations: V;
}

export interface AuditOptions {
  /** Per-rule overrides. Every rule runs at its default severity unless listed
      here: set `"off"` to disable it, or `"error"`/`"warning"` to
      re-grade it. See {@link RuleOverride}. */
  rules?: Partial<Record<RuleId, RuleOverride>>;
  /** Reshape the result's `violations` to this view. Omit to keep the structured
      {@link Violation}`[]`. See {@link Formatted} for the type each one yields. */
  format?: AuditFormat;
}
