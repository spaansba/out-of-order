import { tabbable } from "tabbable";
import type {
  AnalyzeOptions,
  SequenceEntry,
  Severity,
  TabOrderResult,
  Violation,
  RuleId,
} from "./types.js";
import { selectorFor } from "./dom.js";
import { ALL_RULES, DEFAULT_SEVERITY } from "./rules.js";

/** Fold a rule's caller override against its default into a final decision: is it
    on, and at what severity? A missing override keeps the default; `"off"` disables
    it; a severity string re-grades it. */
function resolveRule(
  options: AnalyzeOptions,
  rule: RuleId,
): { enabled: boolean; severity: Severity } {
  const setting = options.rules?.[rule];
  if (setting === undefined) {
    return { enabled: true, severity: DEFAULT_SEVERITY[rule] };
  }
  if (setting === "off") {
    return { enabled: false, severity: DEFAULT_SEVERITY[rule] };
  }
  return { enabled: true, severity: setting };
}

/**
 * Compute the tab sequence for `root` and grade it against the enabled rules.
 *
 * Browser-only by design: `tabbable` uses real CSS layout to decide visibility and
 * the visual-order rule reads bounding rects, neither meaningful under jsdom.
 */
export function analyzeTabOrder(
  root: ParentNode = document,
  options: AnalyzeOptions = {},
): TabOrderResult {
  const container =
    root.nodeType === 9 /* Node.DOCUMENT_NODE */
      ? (root as Document).documentElement
      : (root as Element);

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

  const violations: Violation[] = [];
  for (const ruleId of Object.keys(ALL_RULES) as RuleId[]) {
    const { enabled, severity } = resolveRule(options, ruleId);
    if (!enabled) {
      continue;
    }

    // The rule reports *what's* wrong; severity (its default, or the caller's
    // override) is uniform across that rule's findings, so stamp it on here.
    for (const finding of ALL_RULES[ruleId](sequence, ctx)) {
      violations.push({ ...finding, severity });
    }
  }

  return {
    // Warnings are advisory: only an error means the tab order is invalid.
    valid: !violations.some((violation) => violation.severity === "error"),
    sequence,
    violations,
  };
}
