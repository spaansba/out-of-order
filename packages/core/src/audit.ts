import { tabbable } from "tabbable";
import type {
  AuditOptions,
  AuditFormat,
  Formatted,
  SequenceEntry,
  Severity,
  AuditResult,
  Issue,
  Violation,
  ByElement,
  ByRule,
  Flat,
  RuleId,
} from "./types.js";
import { selectorFor, isRuleIgnored } from "./dom.js";
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

function toIssue(finding: Finding, rule: Rule, severity: Severity): Issue {
  return {
    rule: rule.id,
    severity,
    message: finding.message,
    docs: rule.docs,
    relatedElements: finding.relatedElements,
  };
}

function locate(finding: Finding): {
  element: Element;
  selector: string;
  orderIndex?: number;
} {
  const { target } = finding;
  return "orderIndex" in target
    ? {
        element: target.element,
        selector: target.selector,
        orderIndex: target.orderIndex,
      }
    : { element: target, selector: selectorFor(target) };
}

/**
 * Compute the tab sequence for `root` and grade it against the enabled rules.
 *
 * Browser-only by design: `tabbable` uses real CSS layout to decide visibility and
 * the visual-order rule reads bounding rects, neither meaningful under jsdom.
 *
 * Always returns an `AuditResult`; `options.format` only changes the type of its
 * `violations`, from the structured `Violation[]` to the matching {@link Formatted}
 * view (a string for `"text"`, an array of the named shape otherwise).
 */
export function audit<F extends AuditFormat>(
  root: ParentNode | undefined,
  options: AuditOptions & { format: F },
  customRules?: Rule[],
): AuditResult<Formatted<F>>;
export function audit(
  root?: ParentNode,
  options?: AuditOptions,
  customRules?: Rule[],
): AuditResult;
export function audit(
  root: ParentNode = document,
  options: AuditOptions = {},
  customRules: Rule[] = [],
): AuditResult<Violation[] | string | ByElement[] | ByRule[] | Flat[]> {
  const container =
    root.nodeType === 9 /* Node.DOCUMENT_NODE */
      ? (root as Document).documentElement
      : (root as Element);

  if (!container) {
    return finalize({ valid: true, sequence: [], violations: [] }, options.format);
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

  const byElement = new Map<Element, Violation>();
  for (const rule of [...builtins, ...customRules]) {
    const { enabled, severity } = resolveRule(options, rule);
    if (!enabled) {
      continue;
    }

    for (const finding of rule.run(sequence, ctx)) {
      const { element, selector, orderIndex } = locate(finding);
      let violation = byElement.get(element);
      if (!violation) {
        violation = { element, selector, orderIndex, issues: [] };
        byElement.set(element, violation);
      }
      const issue = toIssue(finding, rule, severity);
      if (isRuleIgnored(element, rule.id)) {
        issue.ignored = true;
      }
      violation.issues.push(issue);
    }
  }

  const violations = [...byElement.values()].sort(
    (a, b) => (a.orderIndex ?? Infinity) - (b.orderIndex ?? Infinity),
  );
  for (const violation of violations) {
    violation.issues.sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1,
    );
  }

  const hasErrors = violations.some((violation) =>
    violation.issues.some(
      (issue) => issue.severity === "error" && !issue.ignored,
    ),
  );

  return finalize({ valid: !hasErrors, sequence, violations }, options.format);
}

// Leaves `valid` and `sequence` untouched; only reshapes `violations`.
function finalize(
  result: AuditResult,
  format?: AuditFormat,
): AuditResult<Violation[] | string | ByElement[] | ByRule[] | Flat[]> {
  if (!format) {
    return result;
  }
  return { ...result, violations: reshape(result.violations, format) };
}

function reshape(
  violations: Violation[],
  format: AuditFormat,
): string | ByElement[] | ByRule[] | Flat[] {
  switch (format) {
    case "text":
      return renderText(violations);
    case "by-element":
      return byElement(violations);
    case "by-rule":
      return byRule(violations);
    case "flat":
      return flat(violations);
  }
}

const related = (issue: Issue): string[] | undefined =>
  issue.relatedElements?.map(selectorFor);

function byElement(violations: Violation[]): ByElement[] {
  return violations.map((violation) => ({
    selector: violation.selector,
    orderIndex: violation.orderIndex,
    issueCount: violation.issues.length,
    issues: violation.issues.map((issue) => ({
      rule: issue.rule,
      severity: issue.severity,
      message: issue.message,
      docs: issue.docs,
      related: related(issue),
      ignored: issue.ignored,
    })),
  }));
}

function byRule(violations: Violation[]): ByRule[] {
  const groups = new Map<string, ByRule>();
  for (const violation of violations) {
    for (const issue of violation.issues) {
      let group = groups.get(issue.rule);
      if (!group) {
        group = {
          rule: issue.rule,
          severity: issue.severity,
          docs: issue.docs,
          issueCount: 0,
          elements: [],
        };
        groups.set(issue.rule, group);
      }
      group.elements.push({
        selector: violation.selector,
        orderIndex: violation.orderIndex,
        message: issue.message,
        related: related(issue),
        ignored: issue.ignored,
      });
      group.issueCount = group.elements.length;
    }
  }
  return [...groups.values()];
}

function flat(violations: Violation[]): Flat[] {
  return violations.flatMap((violation) =>
    violation.issues.map((issue) => ({
      rule: issue.rule,
      severity: issue.severity,
      selector: violation.selector,
      orderIndex: violation.orderIndex,
      message: issue.message,
      docs: issue.docs,
      related: related(issue),
      ignored: issue.ignored,
    })),
  );
}

function renderText(violations: Violation[]): string {
  if (!violations.length) {
    return "No tab-order issues.";
  }
  return violations
    .map((violation) => {
      const pos =
        violation.orderIndex !== undefined ? `#${violation.orderIndex + 1} ` : "";
      const issues = violation.issues
        .map(
          (issue) =>
            `  - ${issue.severity.toUpperCase()} [${issue.rule}] ${issue.message}` +
            (issue.relatedElements?.length
              ? ` (related: ${issue.relatedElements.map(selectorFor).join(", ")})`
              : "") +
            (issue.ignored ? " (ignored via data-ooo-ignore)" : ""),
        )
        .join("\n");
      return `${pos}${violation.selector}\n${issues}`;
    })
    .join("\n\n");
}
