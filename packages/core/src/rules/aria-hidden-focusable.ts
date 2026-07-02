import { inAriaHidden } from "../dom/index.js";
import { flagEntries, type RuleDef } from "./rule.js";

export const ariaHiddenFocusable: RuleDef = {
  docs: "https://www.w3.org/TR/wai-aria-1.2/#aria-hidden",
  severity: "error",
  run: (sequence) =>
    flagEntries(sequence, (entry) =>
      inAriaHidden(entry.element)
        ? `"${entry.selector}" is tabbable but inside aria-hidden="true", so a screen-reader user lands on a control the SR won't announce. Add tabindex="-1"/inert, or remove aria-hidden.`
        : null,
    ),
};
