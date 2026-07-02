import { audit, formatViolations } from "@out-of-order/core";

(
  globalThis as unknown as {
    __ooo: { audit: typeof audit; formatViolations: typeof formatViolations };
  }
).__ooo = { audit, formatViolations };
