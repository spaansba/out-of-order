import { trace } from "@out-of-order/trace";
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

const overlay = trace();
const teardown = [() => overlay.destroy(), wireVirtualList()];

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => teardown.forEach((fn) => fn()));
}
