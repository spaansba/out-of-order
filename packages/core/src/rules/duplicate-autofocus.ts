import { isFocusable } from "tabbable";
import { composedDescendants, selectorFor } from "../dom/index.js";
import type { RuleDef } from "./rule.js";

/** autofocus applies to any *focusable* element (even tabindex="-1" non-stops), and
    the browser focuses the first in *document* order — so scan the whole container,
    not `sequence`. The first focusable one wins; the rest are dead intent. */
export const duplicateAutofocus: RuleDef = {
  docs: "https://html.spec.whatwg.org/multipage/interaction.html#the-autofocus-attribute",
  severity: "warning",
  run: (_sequence, { container }) => {
    const focusableAutofocus = [...composedDescendants(container)].filter(
      (element) =>
        element.hasAttribute("autofocus") && isFocusable(element, { getShadowRoot: true }),
    );
    if (focusableAutofocus.length < 2) {
      return [];
    }

    return focusableAutofocus.slice(1).map((element) => {
      const selector = selectorFor(element);

      return {
        message: `"${selector}" also has autofocus, but a page can autofocus only one element; the first focusable one in document order wins, so this one is silently ignored. Remove the extra autofocus.`,
        target: element,
      };
    });
  },
};
