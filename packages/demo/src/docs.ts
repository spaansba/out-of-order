import { trace } from "@out-of-order/trace";

// Every docs page runs the overlay on itself, so the site is its own live demo.
// The overlay carries its own control panel (show/hide + peek). The docs pages are
// plain markup, so a clean page just shows numbered tab stops and no rings.
const overlay = trace();
const teardown = [() => overlay.destroy()];

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => teardown.forEach((fn) => fn()));
}
