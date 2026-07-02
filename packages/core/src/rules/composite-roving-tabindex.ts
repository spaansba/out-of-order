import { compositeAncestor, explicitRole } from "../dom/index.js";
import type { Finding, RuleDef, SequenceEntry } from "./rule.js";

export const compositeRovingTabindex: RuleDef = {
  docs: "https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/",
  severity: "warning",
  run: (sequence) => {
    const groups = new Map<Element, SequenceEntry[]>();
    for (const entry of sequence) {
      const container = compositeAncestor(entry.element);
      if (!container) {
        continue;
      }
      const list = groups.get(container) ?? [];
      list.push(entry);
      groups.set(container, list);
    }

    const out: Finding[] = [];
    for (const [container, members] of groups) {
      if (members.length < 2) {
        continue;
      }

      // Browser roves native radio groups itself: all-tabbable is correct when none is checked.
      if (
        members.every(
          (entry) => entry.element instanceof HTMLInputElement && entry.element.type === "radio",
        )
      ) {
        continue;
      }

      const role = explicitRole(container);
      const [first, ...rest] = members;
      out.push({
        message: `${members.length} items inside role="${role}" are separate tab stops. A ${role} should expose one tab stop and move between items with the arrow keys (roving tabindex).`,
        target: first!,
        relatedElements: rest.map((entry) => entry.element),
      });
    }

    return out;
  },
};
