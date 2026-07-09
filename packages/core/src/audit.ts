import { tabbable, getTabIndex } from "tabbable";
import { isRuleIgnored } from "./dom/ignore.js";
import { createReads } from "./dom/reads.js";
import { floatingAncestor } from "./dom/visibility.js";
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
  /** Suggested remediation, when the rule has one. */
  fix?: string;
  /** Spec link for the rule (WCAG, WAI-ARIA, or ARIA APG). */
  docs?: string;
  /** Other elements sharing this issue's root cause. */
  relatedElements?: Element[];
  /** Approved (silenced) by a `data-ooo-ignore` on the element */
  ignored?: boolean;
}

/** One graded element */
export interface Entry {
  element: Element;
  issues: Issue[];
  /** Zero-based position in the tab sequence, when the element is a tab stop. */
  orderIndex?: number;
  /** Resolved tabindex, when the element is a tab stop. */
  tabIndex?: number;
  /** Bounding rect at analysis time, when the element is a tab stop. */
  rect?: DOMRect;
  /** The fixed/sticky ancestor-or-self the element rides in, or null in flow. */
  floatRoot?: Element | null;
}

export interface AuditResult {
  /** True when no enabled rule produced an `error` severity finding. */
  valid: boolean;
  /** Every tab stop in the exact order tabbing reaches them, each carrying its
      issues */
  sequence: Entry[];
  /** Flagged elements that aren't tab stops at all (interactive but not
      focusable); each always carries at least one issue. */
  offSequence: Entry[];
}

/** Every flagged element (tab stops first, then off-sequence), one row each.  */
export function flaggedEntries(result: AuditResult): Entry[] {
  return [...result.sequence, ...result.offSequence].filter((entry) => entry.issues.length > 0);
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
    fix: finding.fix,
    docs: rule.docs,
    relatedElements: finding.relatedElements,
  };
}

function locate(finding: Finding): Element {
  const { target } = finding;
  return "orderIndex" in target ? target.element : target;
}

function computeTabSequence(container: Element, reads: ReturnType<typeof createReads>) {
  const elements = tabbable(container, {
    getShadowRoot: true,
  });

  const sequence: SequenceEntry[] = elements.map((element, orderIndex) => ({
    element,
    orderIndex,
    tabIndex: getTabIndex(element),
    rect: reads.rect(element),
    floatRoot: floatingAncestor(element, reads),
  }));

  return sequence;
}

const builtins: Rule[] = Object.entries(ALL_RULES).map(([id, def]) => ({
  id,
  ...def,
}));

function assembleRules(options: AuditOptions): Rule[] {
  const customRules = options.customRules ?? [];
  const rules = [...builtins, ...customRules];
  warnDuplicateRuleIds(builtins, customRules);
  warnUnknownRules(options.rules, rules);
  return rules;
}

function collectIssues(
  rules: Rule[],
  options: AuditOptions,
  sequence: SequenceEntry[],
  ctx: Parameters<Rule["run"]>[1],
): Map<Element, Issue[]> {
  const byElement = new Map<Element, Issue[]>();
  for (const rule of rules) {
    const { enabled, severity } = resolveRule(options, rule);
    if (!enabled) {
      continue;
    }

    for (const finding of rule.run(sequence, ctx)) {
      const element = locate(finding);
      let issues = byElement.get(element);
      if (!issues) {
        issues = [];
        byElement.set(element, issues);
      }
      const issue = toIssue(finding, rule, severity);
      if (isRuleIgnored(element, rule.id)) {
        issue.ignored = true;
      }
      issues.push(issue);
    }
  }
  return byElement;
}

export function bySeverity<T extends { severity: Severity }>(items: T[]): T[] {
  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}

function hasUnignoredError(entries: Entry[]): boolean {
  return entries.some((entry) =>
    entry.issues.some((issue) => issue.severity === "error" && !issue.ignored),
  );
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
  // Duck-typed instead of instanceof so documents from other realms (iframes) work.
  const container = "documentElement" in root ? root.documentElement : root;

  if (!container) {
    return { valid: true, sequence: [], offSequence: [] };
  }

  const reads = createReads();
  const tabbed = computeTabSequence(container, reads);
  const entryFor = new Map(tabbed.map((entry) => [entry.element, entry]));
  const ctx = {
    container,
    inSequence: new Set(entryFor.keys()),
    reads,
  };

  const rules = assembleRules(options);
  const found = collectIssues(rules, options, tabbed, ctx);

  const sequence: Entry[] = tabbed.map((entry) => ({
    element: entry.element,
    orderIndex: entry.orderIndex,
    tabIndex: entry.tabIndex,
    rect: entry.rect,
    floatRoot: entry.floatRoot,
    issues: bySeverity(found.get(entry.element) ?? []),
  }));

  const offSequence: Entry[] = [];
  for (const [element, issues] of found) {
    if (entryFor.has(element)) {
      continue;
    }
    offSequence.push({
      element,
      floatRoot: floatingAncestor(element, reads),
      issues: bySeverity(issues),
    });
  }

  return { valid: !hasUnignoredError([...sequence, ...offSequence]), sequence, offSequence };
}
