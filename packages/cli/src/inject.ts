import { audit } from "@out-of-order/core";

(globalThis as unknown as { __ooo: { audit: typeof audit } }).__ooo = { audit };
