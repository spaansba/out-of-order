import { isFocusable } from "tabbable";
import { composedDescendants, selectorFor } from "../dom/index.js";
import type { Finding, RuleDef } from "./rule.js";

export const autofocusNotFocusable: RuleDef = {
  docs: "https://html.spec.whatwg.org/multipage/interaction.html#the-autofocus-attribute",
  severity: "warning",
  run: (_sequence, { container }) => {
    const out: Finding[] = [];
    for (const element of composedDescendants(container)) {
      if (!element.hasAttribute("autofocus")) {
        continue;
      }
      if (isFocusable(element, { getShadowRoot: true })) {
        continue;
      }

      const selector = selectorFor(element);
      out.push({
        message: `"${selector}" has autofocus but isn't focusable (no tabindex, not a form control), so it's ignored on load. Remove the autofocus, or make the element focusable (e.g. tabindex="-1").`,
        target: element,
      });
    }

    return out;
  },
};
