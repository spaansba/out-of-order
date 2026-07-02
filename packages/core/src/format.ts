import { selectorFor } from "./dom/index.js";
import type { AuditResult, Issue, Violation } from "./audit.js";
import type { Severity } from "./rules/index.js";

/** Serializable views of an audit's violations: grouped by element or by rule,
    flattened to one entry per issue, or a human-readable text block. */
export type AuditFormat = "text" | "by-element" | "by-violation" | "flat";

/** A rule failure with its element references flattened to selector strings, so it
    survives serialization (e.g. `JSON.stringify`) unlike {@link Issue}, which holds
    live `Element`s. The issue shape shared by the formatted views. */
export interface SerializedIssue {
  rule: Issue["rule"];
  severity: Severity;
  message: string;
  docs?: string;
  /** Selectors of the elements sharing this issue's root cause. */
  related?: string[];
  /** Approved (silenced) by a `data-ooo-ignore` */
  ignored?: boolean;
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

/** `"by-violation"` format: one entry per failed rule, the offending elements
    nested. Errors sort before warnings. */
export interface ByViolation {
  rule: Issue["rule"];
  severity: Severity;
  docs?: string;
  /** How many elements failed this rule (`elements.length`). */
  elementCount: number;
  elements: {
    selector: string;
    orderIndex?: number;
    message: string;
    related?: string[];
    ignored?: boolean;
  }[];
}

/** `"flat"` format: one entry per element-issue pair, nothing nested. */
export interface FlatIssue extends SerializedIssue {
  selector: string;
  orderIndex?: number;
}

/**
 * Reshape a result's violations into the named view: a human-readable string for
 * `"text"`, else the matching serializable array (no live `Element`s, safe to
 * `JSON.stringify`). Leaves the result itself untouched.
 */
export function formatViolations(result: AuditResult, format: "text"): string;
export function formatViolations(result: AuditResult, format: "by-element"): ByElement[];
export function formatViolations(result: AuditResult, format: "by-violation"): ByViolation[];
export function formatViolations(result: AuditResult, format: "flat"): FlatIssue[];
export function formatViolations(
  result: AuditResult,
  format: AuditFormat,
): string | ByElement[] | ByViolation[] | FlatIssue[];
export function formatViolations(
  result: AuditResult,
  format: AuditFormat,
): string | ByElement[] | ByViolation[] | FlatIssue[] {
  switch (format) {
    case "text":
      return renderText(result.violations);
    case "by-element":
      return byElement(result.violations);
    case "by-violation":
      return byViolation(result.violations);
    case "flat":
      return flat(result.violations);
  }
}

const related = (issue: Issue): string[] | undefined => issue.relatedElements?.map(selectorFor);

function serialize(issue: Issue): SerializedIssue {
  return {
    rule: issue.rule,
    severity: issue.severity,
    message: issue.message,
    docs: issue.docs,
    related: related(issue),
    ignored: issue.ignored,
  };
}

function byElement(violations: Violation[]): ByElement[] {
  return violations.map((violation) => ({
    selector: violation.selector,
    orderIndex: violation.orderIndex,
    issueCount: violation.issues.length,
    issues: violation.issues.map(serialize),
  }));
}

function byViolation(violations: Violation[]): ByViolation[] {
  const byRule = new Map<Issue["rule"], ByViolation>();
  for (const violation of violations) {
    for (const issue of violation.issues) {
      let entry = byRule.get(issue.rule);
      if (!entry) {
        entry = {
          rule: issue.rule,
          severity: issue.severity,
          docs: issue.docs,
          elementCount: 0,
          elements: [],
        };
        byRule.set(issue.rule, entry);
      }
      entry.elements.push({
        selector: violation.selector,
        orderIndex: violation.orderIndex,
        message: issue.message,
        related: related(issue),
        ignored: issue.ignored,
      });
      entry.elementCount = entry.elements.length;
    }
  }
  return [...byRule.values()].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1,
  );
}

function flat(violations: Violation[]): FlatIssue[] {
  return violations.flatMap((violation) =>
    violation.issues.map((issue) => ({
      selector: violation.selector,
      orderIndex: violation.orderIndex,
      ...serialize(issue),
    })),
  );
}

function renderText(violations: Violation[]): string {
  if (!violations.length) {
    return "No tab-order issues.";
  }
  return violations
    .map((violation) => {
      const pos = violation.orderIndex !== undefined ? `#${violation.orderIndex + 1} ` : "";
      const issues = violation.issues
        .map((issue) => {
          const rel = related(issue);
          return (
            `  - ${issue.severity.toUpperCase()} [${issue.rule}] ${issue.message}` +
            (rel?.length ? ` (related: ${rel.join(", ")})` : "") +
            (issue.ignored ? " (ignored via data-ooo-ignore)" : "") +
            (issue.docs ? `\n    ${issue.docs}` : "")
          );
        })
        .join("\n");
      return `${pos}${violation.selector}\n${issues}`;
    })
    .join("\n\n");
}
