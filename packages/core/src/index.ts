export { audit } from "./audit.js";
export type { AuditOptions, RuleOverride, AuditResult, Issue, Violation } from "./audit.js";
export { formatViolations } from "./format.js";
export type { AuditFormat, ByElement, ByViolation, FlatIssue, SerializedIssue } from "./format.js";
export { DEFAULT_SEVERITY } from "./rules/index.js";
export type { Rule, Finding, RuleId, SequenceEntry, Severity } from "./rules/index.js";
export {
  isInteractive,
  isScreenReaderOnly,
  selectorFor,
  isRuleIgnored,
  composedDescendants,
} from "./dom/index.js";
