export { audit } from "./audit.js";
export { DEFAULT_SEVERITY } from "./rules.js";
export type { Rule, Finding } from "./rules.js";
export { isInteractive, selectorFor } from "./dom.js";
export { OVERLAY_CLASS_PREFIX } from "./overlay-classes.js";
export type {
  AuditOptions,
  RuleId,
  RuleOverride,
  SequenceEntry,
  Severity,
  AuditResult,
  Violation,
} from "./types.js";
import type { Violation } from "./types.js";
import { selectorFor } from "./dom.js";

/** Format violations into a readable multi-line block for test messages/logs. */
export function formatViolations(violations: Violation[]): string {
  if (violations.length === 0) {
    return "No tab-order violations.";
  }

  return violations
    .map((violation, idx) => {
      const pos =
        violation.orderIndex !== undefined
          ? ` (tab #${violation.orderIndex + 1})`
          : "";
      const related = violation.relatedElements?.length
        ? `\n   related: ${violation.relatedElements.map(selectorFor).join(", ")}`
        : "";
      return `${idx + 1}. ${violation.severity.toUpperCase()} [${violation.rule}]${pos} ${violation.message}\n   docs: ${violation.docs}${related}`;
    })
    .join("\n");
}
