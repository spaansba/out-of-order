// The overlay's CSS namespace, shared with core so the prefix can't drift: core
// strips any class starting with it when building selectors, so the overlay's own
// rings/badges never leak into analysis.
import { OVERLAY_CLASS_PREFIX } from "@out-of-order/core";

export const RING_CLASS = `${OVERLAY_CLASS_PREFIX}ring`;
export const RING_BAD_CLASS = `${RING_CLASS}--bad`;
export const RING_WARN_CLASS = `${RING_CLASS}--warn`;
