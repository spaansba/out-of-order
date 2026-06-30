// The overlay's CSS namespace. Must stay in sync with @focuspocus/core's own
// OVERLAY_CLASS_PREFIX: core strips any class starting with this prefix when it
// builds selectors, so the overlay's own rings/badges never leak into analysis.
const OVERLAY_CLASS_PREFIX = "fp-";

export const RING_CLASS = `${OVERLAY_CLASS_PREFIX}ring`;
export const RING_BAD_CLASS = `${RING_CLASS}--bad`;
export const RING_WARN_CLASS = `${RING_CLASS}--warn`;
