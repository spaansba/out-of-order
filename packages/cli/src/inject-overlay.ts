import { trace } from "@out-of-order/trace";

const mount = (): void => void trace();

if (document.readyState === "complete") {
  mount();
} else {
  window.addEventListener("load", mount, { once: true });
}
