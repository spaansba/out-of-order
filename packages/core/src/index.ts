export { audit } from "./audit.js";
export { DEFAULT_SEVERITY } from "./rules.js";
export type { Rule, Finding } from "./rules.js";
export {
  isInteractive,
  isScreenReaderOnly,
  selectorFor,
  isRuleIgnored,
  IGNORE_ATTRIBUTE,
} from "./dom.js";
export { OVERLAY_CLASS_PREFIX } from "./overlay-classes.js";
export type {
  AuditOptions,
  AuditFormat,
  Formatted,
  ByElement,
  ByRule,
  Flat,
  SerializedIssue,
  RuleId,
  RuleOverride,
  SequenceEntry,
  Severity,
  AuditResult,
  Issue,
  Violation,
} from "./types.js";
