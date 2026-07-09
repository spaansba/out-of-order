import { nativeReplacement } from "../dom/semantics.js";
import { flagEntries, type RuleDef } from "./rule.js";

export const preferNativeElement: RuleDef = {
  docs: "https://www.w3.org/TR/using-aria/#firstrule",
  severity: "warning",
  run: (sequence) =>
    flagEntries(sequence, (entry) => {
      const native = nativeReplacement(entry.element);
      if (!native) {
        return null;
      }
      const tag = entry.element.tagName.toLowerCase();
      const role = entry.element.getAttribute("role");
      return {
        message: `Element is a <${tag}> with role="${role}".`,
        fix: `Prefer a native ${native}: focus, keyboard activation (Enter/Space), and screen-reader semantics come for free, instead of being reimplemented with ARIA + JS.`,
      };
    }),
};
