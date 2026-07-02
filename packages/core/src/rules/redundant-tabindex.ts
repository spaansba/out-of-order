import { isNativelyFocusable } from "../dom/index.js";
import { flagEntries, type RuleDef } from "./rule.js";

/** A natively focusable element (<button>, <a href>, <input>, …) carrying an
    explicit tabindex="0". It's already a tab stop, so the attribute is a no-op:
    redundant markup that adds noise and invites a positive value to creep in later.
    tabindex="-1" (removed from the sequence) and positive values (no-positive-tabindex)
    aren't redundant and never reach here. */
export const redundantTabindex: RuleDef = {
  docs: "https://html.spec.whatwg.org/multipage/interaction.html#attr-tabindex",
  severity: "warning",
  run: (sequence) =>
    flagEntries(sequence, (entry) => {
      if (entry.tabIndex !== 0) {
        return null;
      }
      if (entry.element.getAttribute("tabindex") === null) {
        return null;
      } // implicitly focusable, no attribute to remove
      if (!isNativelyFocusable(entry.element)) {
        return null;
      }
      return `"${entry.selector}" is already focusable, so its tabindex="0" is redundant. Remove the attribute; the element stays in the tab order on its own.`;
    }),
};
