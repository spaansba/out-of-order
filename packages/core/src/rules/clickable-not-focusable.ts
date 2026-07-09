import {
  composedDescendants,
  composedParent,
  isAriaDisabled,
  isDisplayed,
  isFocusManaged,
  isInert,
  looksClickable,
} from "../dom/index.js";
import type { Finding, RuleDef } from "./rule.js";

export const clickableNotFocusable: RuleDef = {
  docs: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
  severity: "error",
  run: (_sequence, { container, inSequence, reads }) => {
    // Every ancestor-or-self of a tab stop, collected once. A clickable element
    // that's in this set merely wraps a real focusable control, so the keyboard
    // can still get in, so skip it.
    const wrapsFocusable = new Set<Element>();
    for (const stop of inSequence) {
      for (let node: Element | null = stop; node; node = composedParent(node)) {
        if (wrapsFocusable.has(node)) {
          break;
        }
        wrapsFocusable.add(node);
      }
    }

    const out: Finding[] = [];
    for (const element of composedDescendants(container)) {
      if (inSequence.has(element)) {
        continue;
      }

      if (wrapsFocusable.has(element)) {
        continue;
      }

      if (!looksClickable(element)) {
        continue;
      }

      if (isAriaDisabled(element)) {
        continue;
      }

      // Reachable by arrow keys / a virtual cursor rather than Tab (roving tabindex,
      // a composite container, or aria-activedescendant): deliberately out of the Tab
      // sequence, not unreachable. Its container is the keyboard entry point.
      if (isFocusManaged(element)) {
        continue;
      }

      // Inside an inert subtree (e.g. the background while a modal is open): nothing
      // here is reachable by mouse OR keyboard, by design. That's a focus-trap concern
      // (focus-escapes-modal), not a clickable-but-unfocusable bug, so don't flag it.
      if (isInert(element)) {
        continue;
      }

      const rect = reads.rect(element);
      if (rect.width < 1 || rect.height < 1) {
        continue;
      } // not rendered / no target

      // visibility:hidden keeps its layout box but receives no pointer events, so
      // it isn't mouse-clickable either: no keyboard parity gap to flag.
      if (!isDisplayed(element, reads)) {
        continue;
      }
      out.push({
        message: `Element looks interactive (role or onclick) but is not in the tab order, so keyboard users can't reach it.`,
        fix: `Use a <button>/<a>, or add tabindex="0" plus Enter/Space handlers.`,
        target: element,
      });
    }

    return out;
  },
};
