import { trace } from "@out-of-order/trace";
import type { Rule } from "@out-of-order/core";
import { wireSolvers } from "./fixes.js";
import { wireModal } from "./modal.js";
import { restoreAutofocus, wireTriage } from "./triage.js";

// A custom rule (not part of core), passed through trace's `rules` option so it runs
// on the overlay next to the built-ins - see the all-caps card. It flags any tab stop
// whose label is ALL CAPS.
const noShouting: Rule = {
  id: "no-shouting",
  docs: "https://www.rfc-editor.org/rfc/rfc1855",
  defaultSeverity: "warning",
  run: (sequence) =>
    sequence
      .filter((entry) => {
        const letters = (entry.element.textContent ?? "").replace(/[^a-z]/gi, "");
        return letters.length >= 3 && letters === letters.toUpperCase();
      })
      .map((entry) => ({
        message: "This label is ALL CAPS, which reads as shouting. Use sentence case.",
        target: entry,
      })),
};

const overlay = trace({ rules: [noShouting] });

// Each card gets a "Solve" button; the overlay re-analyzes on DOM mutation, so a
// fix just touches the DOM and that card's badges flip green on their own.
const teardown = [() => overlay.destroy(), wireTriage(), wireSolvers(), wireModal()];

// wireTriage reorders the warning cards with appendChild, and re-inserting an element
// that already carries `autofocus` re-arms the browser's autofocus pass, so it would grab
// focus and scroll into that card on load. Promote data-autofocus -> autofocus only after
// the reorder and the first paint: setAttribute on a settled DOM never triggers focus, and
// the overlay re-analyzes on the resulting mutation so the autofocus rules still fire.
requestAnimationFrame(() => requestAnimationFrame(restoreAutofocus));

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => teardown.forEach((fn) => fn()));
}
