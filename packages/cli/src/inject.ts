import { audit, formatViolations, selectorFor } from "@out-of-order/core";

(
  globalThis as unknown as {
    __ooo: {
      audit: typeof audit;
      formatViolations: typeof formatViolations;
      selectorFor: typeof selectorFor;
    };
  }
).__ooo = { audit, formatViolations, selectorFor };
