import { composedDescendants, containsComposed } from "../dom/composed-tree.js";
import type { DomReads } from "../dom/reads.js";
import { isDisplayed, isInert } from "../dom/visibility.js";
import type { RuleDef } from "./rule.js";

/** The first genuinely-modal, on-screen container in `root`: a `<dialog>:modal`
    (opened via showModal()) or an `aria-modal="true"` element. Non-modal dialogs
    (show() or a bare `open`) and hidden ones are excluded, since their background is
    meant to stay interactive. */
function openModal(root: ParentNode, reads: DomReads): Element | null {
  for (const element of composedDescendants(root)) {
    if (element.matches('dialog:modal, [aria-modal="true"]') && isDisplayed(element, reads)) {
      return element;
    }
  }
  return null;
}

export const focusEscapesModal: RuleDef = {
  docs: "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/",
  severity: "error",
  run: (sequence, { container, reads }) => {
    const modal = openModal(container, reads);
    if (!modal) {
      return [];
    }

    const leaked = sequence.filter(
      (entry) => !containsComposed(modal, entry.element) && !isInert(entry.element),
    );

    if (leaked.length === 0) {
      return [];
    }

    const first = leaked[0]!;
    const subject =
      leaked.length === 1
        ? `this control outside it is still tabbable`
        : `${leaked.length} controls outside it (this one included) are still tabbable`;

    return [
      {
        message: `A modal dialog is open, but ${subject}, so focus can leak behind the dialog.`,
        fix: `Mark background content inert (or aria-hidden + remove it from the tab order).`,
        target: first,
        // One finding, anchored on the first leaked control, but every other leaked
        // control shares the root cause (background not inert) and is ringed too.
        relatedElements: leaked.slice(1).map((entry) => entry.element),
      },
    ];
  },
};
