import { trace } from "@out-of-order/trace";
import type { AuditOptions } from "@out-of-order/core";

// The CLI passes --rule overrides through an init script that runs before this one.
const options = (globalThis as { __oooAuditOptions?: AuditOptions }).__oooAuditOptions;

const mount = (): void => void trace({ audit: options });

if (document.readyState === "complete") {
  mount();
} else {
  window.addEventListener("load", mount, { once: true });
}
