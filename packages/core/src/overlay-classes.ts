/** The overlay's CSS namespace; every injected class (ring, badge, tooltip) starts
    with it, so analysis can strip them. A side-effect-free leaf module so the
    page-evaluatable dom.ts can import the prefix without overlay-styles.ts's CSS. */
export const OVERLAY_CLASS_PREFIX = "fp-";

/** Classes on tracked page elements; CSS rings them (green when fine, amber on a
    warning, red on an error) and reverts to the native ring on focus. */
export const RING_CLASS = `${OVERLAY_CLASS_PREFIX}ring`;
export const RING_BAD_CLASS = `${RING_CLASS}--bad`;
export const RING_WARN_CLASS = `${RING_CLASS}--warn`;
