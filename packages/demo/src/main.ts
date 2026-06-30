import { reveal } from "@focuspocus/reveal";
import { wireOverlayControls } from "./controls.js";
import { wireVirtualList } from "./virtual-list.js";

const host = document.getElementById("shadow-host");
if (host && !host.shadowRoot) {
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <button
      style="font:inherit;padding:7px 13px;border:1px solid #e4e6ea;border-radius:7px;background:#f3f4f6;cursor:pointer"
    >
      Button inside shadow DOM
    </button>
  `;
}

const overlay = reveal();
// Collect a teardown for every side effect this module plants on the persistent
// page DOM, so the HMR dispose can undo all of them - not just the overlay.
const teardown = [
  () => overlay.destroy(),
  wireOverlayControls([overlay]),
  wireVirtualList(),
];

// HMR boundary. A reveal/core edit (e.g. ../reveal/src/*.ts) bubbles up to this
// self-accepting module, which re-runs top to bottom. Undo every side effect on
// dispose first, or each re-run stacks another overlay/listener on the page.
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => teardown.forEach((fn) => fn()));
}
