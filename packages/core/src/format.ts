import { selectorFor } from "./dom/index.js";
import { flaggedEntries, type AuditResult, type Issue, type Entry } from "./audit.js";
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
  fix?: string;
  docs?: string;
  /** Selectors of the elements sharing this issue's root cause. */
  related?: string[];
  /** Approved (silenced) by a `data-ooo-ignore` */
  ignored?: boolean;
}

/** `"by-element"` format: one entry per offending element, its issues nested. The
    serializable twin of a flagged {@link Entry}. */
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
    fix?: string;
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
  const flagged = flaggedEntries(result);
  switch (format) {
    case "text":
      return renderText(flagged);
    case "by-element":
      return byElement(flagged);
    case "by-violation":
      return byViolation(flagged);
    case "flat":
      return flat(flagged);
  }
}

/** A format rendered to a string: "text" as-is, the structured views
    JSON-stringified. What consumers that copy or print a report want. */
export function reportText(result: AuditResult, format: AuditFormat): string {
  const rendered = formatViolations(result, format);
  return typeof rendered === "string" ? rendered : JSON.stringify(rendered, null, 2);
}

const related = (issue: Issue): string[] | undefined => issue.relatedElements?.map(selectorFor);

function serialize(issue: Issue): SerializedIssue {
  return {
    rule: issue.rule,
    severity: issue.severity,
    message: issue.message,
    fix: issue.fix,
    docs: issue.docs,
    related: related(issue),
    ignored: issue.ignored,
  };
}

function byElement(entries: Entry[]): ByElement[] {
  return entries.map((entry) => ({
    selector: entry.selector,
    orderIndex: entry.orderIndex,
    issueCount: entry.issues.length,
    issues: entry.issues.map(serialize),
  }));
}

function byViolation(entries: Entry[]): ByViolation[] {
  const byRule = new Map<Issue["rule"], ByViolation>();
  for (const violation of entries) {
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
        fix: issue.fix,
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

function flat(entries: Entry[]): FlatIssue[] {
  return entries.flatMap((violation) =>
    violation.issues.map((issue) => ({
      selector: violation.selector,
      orderIndex: violation.orderIndex,
      ...serialize(issue),
    })),
  );
}

function renderText(entries: Entry[]): string {
  if (!entries.length) {
    return "No tab-order issues.";
  }
  return entries
    .map((violation) => {
      const pos = violation.orderIndex !== undefined ? `#${violation.orderIndex + 1} ` : "";
      const issues = violation.issues
        .map((issue) => {
          const rel = related(issue);
          return (
            `  - ${issue.severity.toUpperCase()} [${issue.rule}] ${issue.message}` +
            (rel?.length ? ` (related: ${rel.join(", ")})` : "") +
            (issue.ignored ? " (ignored via data-ooo-ignore)" : "") +
            (issue.fix ? `\n    Possible fix: ${issue.fix}` : "") +
            (issue.docs ? `\n    ${issue.docs}` : "")
          );
        })
        .join("\n");
      return `${pos}${violation.selector}\n${issues}`;
    })
    .join("\n\n");
}
