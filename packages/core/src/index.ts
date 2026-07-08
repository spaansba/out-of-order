export { audit } from "./audit.js";
export { flaggedEntries } from "./audit.js";
export type { AuditOptions, RuleOverride, AuditResult, Issue, Entry } from "./types.js";
export { formatViolations, reportText, AUDIT_FORMATS } from "./format.js";
export type { AuditFormat, ByElement, ByViolation, FlatIssue, SerializedIssue } from "./format.js";
export { DEFAULT_SEVERITY } from "./rules/index.js";
export type { Rule, Finding, RuleId, SequenceEntry, Severity } from "./rules/index.js";
export {
  floatingAncestor,
  isInteractive,
  isScreenReaderOnly,
  selectorFor,
  isRuleIgnored,
  composedDescendants,
} from "./dom/index.js";
