import { composedParent, isInteractive, selectorFor } from "../dom/index.js";
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
            ? `"${entry.selector}" is focusable but nested inside another focusable element ("${selectorFor(node)}"). Nesting interactive controls stacks two tab stops in one place and can hide the inner control's role/name from screen readers; don't put a focusable element inside another.`
            : `"${entry.selector}" is focusable but nested inside an interactive element ("${selectorFor(node)}"). Nesting interactive controls can hide the inner control's role/name from screen readers; don't put a focusable element inside another interactive one.`,
          target: entry,
        });

        break;
      }
    }

    return out;
  },
};
