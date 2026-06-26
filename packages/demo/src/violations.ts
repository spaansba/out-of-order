import { mountOverlay } from "@focuspocus/core/overlay";
import { wireOverlayControls } from "./controls.js";
import { wireSolvers } from "./fixes.js";
import { wireModal } from "./modal.js";
import { analyzeTabOrder, formatViolations } from "@focuspocus/core";

const overlay = mountOverlay();

// Collect a teardown for every side effect this module plants on the persistent
// page DOM, so the HMR dispose can undo all of them - not just the overlay.
// Each card gets a "Solve" button; the overlay re-analyzes on DOM mutation, so a
// fix just touches the DOM and that card's badges flip green on their own.
const teardown = [
  () => overlay.destroy(),
  wireOverlayControls([overlay]),
  wireSolvers(),
  wireModal(),
];

// HMR boundary. A core edit (e.g. ../core/src/overlay-*.ts) bubbles up to this
// self-accepting module, which re-runs top to bottom. Undo every side effect on
// dispose first, or each re-run stacks another Fix button / snippet on every card.
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => teardown.forEach((fn) => fn()));
}

console.log(formatViolations(analyzeTabOrder(document).violations));
