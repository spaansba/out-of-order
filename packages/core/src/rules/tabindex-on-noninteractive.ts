import {
  explicitRole,
  isInteractive,
  isNativelyFocusable,
  isNoninteractiveRole,
} from "../dom/semantics.js";
import { isScrollContainer } from "../dom/visibility.js";
import { flagEntries, type RuleDef } from "./rule.js";

export const tabindexOnNoninteractive: RuleDef = {
  docs: "https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/",
  severity: "error",
  run: (sequence, { reads }) =>
    flagEntries(sequence, (entry) => {
      if (entry.tabIndex !== 0) {
        return null;
      }
      if (entry.element.getAttribute("tabindex") === null) {
        return null;
      } // implicitly focusable
      const element = entry.element as HTMLElement;
      if (isNativelyFocusable(element)) {
        return null;
      }
      if (isInteractive(element)) {
        return null;
      }
      if (element.isContentEditable) {
        return null;
      }
      const role = explicitRole(element);
      if (role && !isNoninteractiveRole(role)) {
        return null;
      }
      // A keyboard-scrollable region legitimately takes tabindex="0", even when it
      // isn't currently overflowing, so key on computed overflow, not a live size.
      if (isScrollContainer(element, reads)) {
        return null;
      }
      return {
        message: `Element has tabindex="0" but is non-interactive (no role, not a control), so it adds a dead stop to the tab order.`,
        fix: `If it's decorative, remove the tabindex; if it's meant to be a control, give it a real role (or use a <button>).`,
      };
    }),
};
