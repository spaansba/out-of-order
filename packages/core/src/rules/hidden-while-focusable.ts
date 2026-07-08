import { focusRevealSelectors, hiddenReason, isRevealedOnFocus } from "../dom/index.js";
import { flagEntries, type RuleDef } from "./rule.js";

export const hiddenWhileFocusable: RuleDef = {
  docs: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
  severity: "error",
  run: (sequence, { container, reads }) => {
    // Scan the page's focus-reveal rules once, not per element.
    const revealOnFocus = focusRevealSelectors(container.ownerDocument);
    return flagEntries(sequence, (entry) => {
      const reason = hiddenReason(entry.element, entry.rect, reads);
      // Hidden at rest, but a focus rule reveals it (skip links, on-focus controls):
      // perceivable exactly when a keyboard user reaches it, so it's not a bug.
      if (!reason || isRevealedOnFocus(entry.element, revealOnFocus)) {
        return null;
      }
      return {
        message: `Element is tabbable but ${reason}.`,
        fix: `Hide it from the tab order too (display:none, the hidden attribute, or tabindex="-1"). If it's revealed on :hover, reveal it on :focus as well so keyboard users can see it.`,
      };
    });
  },
};
