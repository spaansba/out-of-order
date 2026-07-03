import { flagEntries, type RuleDef } from "./rule.js";

export const noPositiveTabindex: RuleDef = {
  docs: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
  severity: "error",
  run: (sequence) =>
    flagEntries(sequence, (entry) =>
      entry.tabIndex > 0
        ? {
            message: `Element has tabindex="${entry.tabIndex}". Positive tabindex overrides the natural DOM order and is fragile.`,
            fix: `Use tabindex="0" or restructure the DOM.`,
          }
        : null,
    ),
};
