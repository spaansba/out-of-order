export { analyzeTabOrder } from "./analyze.js";
export { ALL_RULES, RULE_DOCS, DEFAULT_SEVERITY } from "./rules.js";
export type { Rule, Finding } from "./rules.js";
export { isInteractive, selectorFor } from "./dom.js";
export type {
  AnalyzeOptions,
  RuleId,
  RuleSetting,
  SequenceEntry,
  Severity,
  TabOrderResult,
  Violation,
} from "./types.js";
import type { Violation } from "./types.js";

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
      return `${idx + 1}. ${violation.severity.toUpperCase()} [${violation.rule}]${pos} ${violation.message}\n   docs: ${violation.docs}`;
    })
    .join("\n");
}
