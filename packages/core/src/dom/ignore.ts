const IGNORE_ATTRIBUTE = "data-ooo-ignore";

/** Whether `element` opts out of `ruleId` via {@link IGNORE_ATTRIBUTE}. Element-scoped:
    the attribute must sit on the flagged element itself, it is not inherited by
    descendants, so approving one control never silences a whole subtree. */
export function isRuleIgnored(element: Element, ruleId: string): boolean {
  const value = element.getAttribute(IGNORE_ATTRIBUTE);
  if (value === null) {
    return false;
  }

  const ids = value.trim().split(/\s+/).filter(Boolean);
  return ids.length === 0 || ids.includes(ruleId);
}
