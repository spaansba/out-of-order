import { composedParent } from "../dom/composed-tree.js";
import { isInteractive } from "../dom/semantics.js";
import { selectorFor } from "../dom/selector.js";
import type { Finding, RuleDef } from "./rule.js";

export const nestedInteractive: RuleDef = {
  docs: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  severity: "error",
  run: (sequence, { container, inSequence }) => {
    const stop = composedParent(container);
    const out: Finding[] = [];
    for (const entry of sequence) {
      for (
        let node = composedParent(entry.element);
        node && node !== stop;
        node = composedParent(node)
      ) {
        if (!inSequence.has(node) && !isInteractive(node)) {
          continue;
        }

        out.push({
          message: inSequence.has(node)
            ? `Element is focusable but nested inside another focusable element ("${selectorFor(node)}"). Nesting interactive controls stacks two tab stops in one place and can hide the inner control's role/name from screen readers.`
            : `Element is focusable but nested inside an interactive element ("${selectorFor(node)}"). Nesting interactive controls can hide the inner control's role/name from screen readers.`,
          fix: inSequence.has(node)
            ? `Don't put a focusable element inside another; move the inner control out.`
            : `Don't put a focusable element inside another interactive one; move the inner control out.`,
          target: entry,
        });

        break;
      }
    }

    return out;
  },
};
