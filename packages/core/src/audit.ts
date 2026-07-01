import { tabbable } from "tabbable";
import type {
  AuditOptions,
  SequenceEntry,
  Severity,
  AuditResult,
  Violation,
  RuleId,
} from "./types.js";
import { selectorFor } from "./dom.js";
import { ALL_RULES, type Finding, type Rule } from "./rules.js";

/** Fold a rule's caller override against its default into a final decision: is it
    on, and at what severity? A missing override keeps the default; `"off"`
    disables it; a severity string re-grades it. */
function resolveRule(
  options: AuditOptions,
  rule: Rule,
): { enabled: boolean; severity: Severity } {
  // Custom rule ids aren't in the RuleId union. A miss returns undefined.
  const setting = options.rules?.[rule.id as RuleId];
  if (setting === undefined) {
    return { enabled: true, severity: rule.defaultSeverity };
  }
  if (setting === "off") {
    return { enabled: false, severity: rule.defaultSeverity };
  }

  return { enabled: true, severity: setting };
}

function toViolation(
  finding: Finding,
  rule: Rule,
  severity: Severity,
): Violation {
  const { target } = finding;
  const base = {
    rule: rule.id,
    severity,
    message: finding.message,
    docs: rule.docs,
    relatedElements: finding.relatedElements,
  };

  return "orderIndex" in target
    ? {
        ...base,
        element: target.element,
        selector: target.selector,
        orderIndex: target.orderIndex,
      }
    : { ...base, element: target, selector: selectorFor(target) };
}

/**
 * Compute the tab sequence for `root` and grade it against the enabled rules.
 *
 * Browser-only by design: `tabbable` uses real CSS layout to decide visibility and
 * the visual-order rule reads bounding rects, neither meaningful under jsdom.
 */
export function audit(
  root: ParentNode = document,
  options: AuditOptions = {},
  customRules: Rule[] = [],
): AuditResult {
  const container =
    root.nodeType === 9 /* Node.DOCUMENT_NODE */
      ? (root as Document).documentElement
      : (root as Element);

  if (!container) {
    return { valid: true, sequence: [], violations: [] };
  }

  const elements = tabbable(container, {
    getShadowRoot: true,
  });

  const sequence: SequenceEntry[] = elements.map((element, orderIndex) => ({
    element,
    orderIndex,
    selector: selectorFor(element),
    tabIndex: Number(element.getAttribute("tabindex")) || 0,
    rect: element.getBoundingClientRect(),
  }));

  const ctx = {
    container,
    inSequence: new Set(sequence.map((entry) => entry.element)),
  };

  const builtins: Rule[] = Object.entries(ALL_RULES).map(([id, def]) => ({
    id,
    ...def,
  }));

  const violations: Violation[] = [];
  for (const rule of [...builtins, ...customRules]) {
    const { enabled, severity } = resolveRule(options, rule);
    if (!enabled) {
      continue;
    }

    for (const finding of rule.run(sequence, ctx)) {
      violations.push(toViolation(finding, rule, severity));
    }
  }

  const hasErrors = violations.some(
    (violation) => violation.severity === "error",
  );

  return {
    valid: !hasErrors,
    sequence,
    violations,
  };
}
