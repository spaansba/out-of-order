/** The overlay's CSS namespace; every class the overlay injects (ring, badge,
    tooltip) starts with this, so analysis strips any matching class when building
    selectors and never mistakes the overlay's own markup for page content. The
    overlay package (@out-of-order/trace) redeclares the same prefix for the classes
    it applies; the two must stay in sync. A side-effect-free leaf so the
    page-evaluatable dom.ts can import it without pulling in any CSS. */
export const OVERLAY_CLASS_PREFIX = "ooo-";
