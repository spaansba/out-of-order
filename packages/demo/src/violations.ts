import { reveal } from "@focuspocus/reveal";
import type { Rule } from "@focuspocus/core";
import { wireSolvers } from "./fixes.js";
import { wireModal } from "./modal.js";
import { restoreAutofocus, wireTriage } from "./triage.js";

// A custom rule (not built into core), passed through reveal's `rules` option so it
// runs on the overlay alongside the built-ins - see the "unsafe target=_blank" card.
// Flags a link that opens a new tab without rel="noopener", which hands the new page a
// live window.opener back to this one. Mirrors the snippet on the recipes page.
const noUnsafeBlank: Rule = {
  id: "no-unsafe-blank",
  docs: "https://html.spec.whatwg.org/multipage/links.html#link-type-noopener",
  defaultSeverity: "warning",
  run: (sequence) =>
    sequence
      .filter(
        (entry) =>
          entry.element.matches('a[target="_blank"]') &&
          !(entry.element.getAttribute("rel") ?? "").includes("noopener"),
      )
      .map((entry) => ({
        message: 'Link opens a new tab without rel="noopener".',
        target: entry,
      })),
};

const overlay = reveal({ rules: [noUnsafeBlank] });

// Collect a teardown for every side effect this module plants on the persistent
// page DOM, so the HMR dispose can undo all of them - not just the overlay.
// Each card gets a "Solve" button; the overlay re-analyzes on DOM mutation, so a
// fix just touches the DOM and that card's badges flip green on their own.
const teardown = [
  () => overlay.destroy(),
  wireTriage(),
  wireSolvers(),
  wireModal(),
];

// wireTriage reorders the warning cards with appendChild, and re-inserting an element
// that already carries `autofocus` re-arms the browser's autofocus pass, so it would grab
// focus and scroll into that card on load. Promote data-autofocus -> autofocus only after
// the reorder and the first paint: setAttribute on a settled DOM never triggers focus, and
// the overlay re-analyzes on the resulting mutation so the autofocus rules still fire.
requestAnimationFrame(() => requestAnimationFrame(restoreAutofocus));

// HMR boundary. A reveal/core edit (e.g. ../reveal/src/*.ts) bubbles up to this
// self-accepting module, which re-runs top to bottom. Undo every side effect on
// dispose first, or each re-run stacks another Fix button / snippet on every card.
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => teardown.forEach((fn) => fn()));
}
