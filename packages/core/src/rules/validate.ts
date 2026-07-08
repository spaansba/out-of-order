import type { AuditOptions } from "../types.js";
import type { Rule } from "./rule.js";

const warnedDuplicateRuleIds = new Set<string>();

export function warnDuplicateRuleIds(builtins: Rule[], customRules: Rule[]): void {
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

export function warnUnknownRules(overrides: AuditOptions["rules"], known: Rule[]): void {
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
