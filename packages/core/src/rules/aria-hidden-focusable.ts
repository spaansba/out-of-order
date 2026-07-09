import { inAriaHidden } from "../dom/visibility.js";
import { flagEntries, type RuleDef } from "./rule.js";

export const ariaHiddenFocusable: RuleDef = {
  docs: "https://www.w3.org/TR/wai-aria-1.2/#aria-hidden",
  severity: "error",
  run: (sequence) =>
    flagEntries(sequence, (entry) =>
      inAriaHidden(entry.element)
        ? {
            message: `Element is tabbable but inside aria-hidden="true", so a screen-reader user lands on a control the SR won't announce.`,
            fix: `Add tabindex="-1"/inert, or remove aria-hidden.`,
          }
        : null,
    ),
};
