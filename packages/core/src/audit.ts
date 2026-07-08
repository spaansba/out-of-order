import { tabbable, getTabIndex } from "tabbable";
import { isRuleIgnored, createReads, floatingAncestor } from "./dom/index.js";
import {
  ALL_RULES,
  type Finding,
  type Rule,
  type RuleId,
  type SequenceEntry,
  type Severity,
} from "./rules/index.js";
import { warnDuplicateRuleIds, warnUnknownRules } from "./rules/validate.js";
import type { AuditOptions, AuditResult, Entry, Issue } from "./types.js";

/** Every flagged element (tab stops first, then off-sequence), one row each.  */
export function flaggedEntries(result: AuditResult): Entry[] {
  return [...result.sequence, ...result.offSequence].filter((entry) => entry.issues.length > 0);
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
