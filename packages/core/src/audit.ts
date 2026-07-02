import { tabbable, getTabIndex } from "tabbable";
import { selectorFor, isRuleIgnored } from "./dom/index.js";
import {
  ALL_RULES,
  type Finding,
  type Rule,
  type RuleId,
  type SequenceEntry,
  type Severity,
} from "./rules/index.js";

export type RuleOverride = Severity | "off";

type AnyRuleId = RuleId | (string & {});

/** A single rule failure on one element. */
export interface Issue {
  /** Stable rule identifier. */
  rule: AnyRuleId;
  /** How serious this finding is. */
  severity: Severity;
  /** Human-readable description of what's wrong. */
  message: string;
  /** Spec link for the rule (WCAG, WAI-ARIA, or ARIA APG). */
  docs?: string;
  /** Other elements sharing this issue's root cause. */
  relatedElements?: Element[];
  /** Approved (silenced) by a `data-ooo-ignore` on the element */
  ignored?: boolean;
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

export interface AuditResult {
  /** True when no enabled rule produced an `error` severity finding. */
  valid: boolean;
  /** Elements in the exact order tabbing will reach them. */
  sequence: SequenceEntry[];
  /** One entry per offending element, each carrying its failed rules. Pass the
      result to `formatViolations` for a serializable or human-readable view. */
  violations: Violation[];
}

export interface AuditOptions {
  /** Per-rule overrides. Every rule runs at its default severity unless listed
      here: set `"off"` to disable it, or `"error"`/`"warning"` to
      re-grade it. See {@link RuleOverride}. */
  rules?: Partial<Record<RuleId, RuleOverride>>;
  /** Extra rules, run alongside the built-ins. Overridable via `rules` like any
      built-in. */
  customRules?: Rule[];
}

/** Fold a rule's caller override against its default into a final decision: is it
    on, and at what severity? A missing override keeps the default; `"off"`
    disables it; a severity string re-grades it. */
function resolveRule(options: AuditOptions, rule: Rule): { enabled: boolean; severity: Severity } {
  // Custom rule ids aren't in the RuleId union. A miss returns undefined.
  const setting = options.rules?.[rule.id as RuleId];
  if (setting === undefined) {
    return { enabled: true, severity: rule.severity };
  }
  if (setting === "off") {
    return { enabled: false, severity: rule.severity };
  }

  return { enabled: true, severity: setting };
}

const warnedDuplicateRuleIds = new Set<string>();

function warnDuplicateRuleIds(builtins: Rule[], customRules: Rule[]): void {
  if (customRules.length === 0) {
    return;
  }
  const builtinIds = new Set(builtins.map((rule) => rule.id));
  for (const rule of customRules) {
    if (!builtinIds.has(rule.id) || warnedDuplicateRuleIds.has(rule.id)) {
      continue;
    }
    warnedDuplicateRuleIds.add(rule.id);
    console.warn(
      `[out-of-order] Custom rule "${rule.id}" reuses a built-in rule id; ` +
        `both run and report the same element twice. Rename the custom rule.`,
    );
  }
}

const warnedUnknownRules = new Set<string>();

function warnUnknownRules(overrides: AuditOptions["rules"], known: Rule[]): void {
  if (!overrides) {
    return;
  }
  const ids = new Set(known.map((rule) => rule.id));
  for (const key of Object.keys(overrides)) {
    if (ids.has(key) || warnedUnknownRules.has(key)) {
      continue;
    }
    warnedUnknownRules.add(key);
    console.warn(
      `[out-of-order] Unknown rule "${key}" in audit options; it has no effect. ` +
        `Known rules: ${[...ids].join(", ")}.`,
    );
  }
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

function locate(
  finding: Finding,
  entryFor: Map<Element, SequenceEntry>,
): {
  element: Element;
  selector: string;
  orderIndex?: number;
} {
  const { target } = finding;
  // Rules targeting bare Elements may still hit a tab stop; recover its
  // sequence entry so the violation keeps its orderIndex and sorts in place.
  const entry = "orderIndex" in target ? target : entryFor.get(target);
  return entry
    ? {
        element: entry.element,
        selector: entry.selector,
        orderIndex: entry.orderIndex,
      }
    : { element: target as Element, selector: selectorFor(target as Element) };
}

/**
 * Compute the tab sequence for `root` and grade it against the enabled rules.
 *
 * Browser-only by design: `tabbable` uses real CSS layout to decide visibility and
 * the visual-order rule reads bounding rects, neither meaningful under jsdom.
 */
export function audit(
  root: Document | Element = document,
  options: AuditOptions = {},
): AuditResult {
  const customRules = options.customRules ?? [];
  // Duck-typed instead of instanceof so documents from other realms (iframes) work.
  const container = "documentElement" in root ? root.documentElement : root;

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
    tabIndex: getTabIndex(element),
    rect: element.getBoundingClientRect(),
  }));

  const entryFor = new Map(sequence.map((entry) => [entry.element, entry]));
  const ctx = {
    container,
    inSequence: new Set(entryFor.keys()),
  };

  const builtins: Rule[] = Object.entries(ALL_RULES).map(([id, def]) => ({
    id,
    ...def,
  }));
  const rules = [...builtins, ...customRules];
  warnDuplicateRuleIds(builtins, customRules);
  warnUnknownRules(options.rules, rules);

  const byElement = new Map<Element, Violation>();
  for (const rule of rules) {
    const { enabled, severity } = resolveRule(options, rule);
    if (!enabled) {
      continue;
    }

    for (const finding of rule.run(sequence, ctx)) {
      const { element, selector, orderIndex } = locate(finding, entryFor);
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
    violation.issues.some((issue) => issue.severity === "error" && !issue.ignored),
  );

  return { valid: !hasErrors, sequence, violations };
}
