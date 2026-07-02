import { computeAccessibleName } from "dom-accessibility-api";
import { hasExplicitName, isInteractive } from "../dom/index.js";
import { flagEntries, type RuleDef } from "./rule.js";

export const missingAccessibleName: RuleDef = {
  docs: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  severity: "error",
  run: (sequence) =>
    flagEntries(sequence, (entry) => {
      if (!isInteractive(entry.element)) {
        return null;
      }
      // Skip the costly subtree walk when a name is already guaranteed.
      if (hasExplicitName(entry.element)) {
        return null;
      }
      if (computeAccessibleName(entry.element).trim() !== "") {
        return null;
      }
      return `Focusable element "${entry.selector}" has no accessible name (no text, aria-label, aria-labelledby, associated label, alt, or title).`;
    }),
};
