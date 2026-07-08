import { Renderer } from "./render.js";

export function wirePageEvents(
  layer: HTMLElement,
  renderer: Renderer,
  requestBuild: () => void,
): () => void {
  const ac = new AbortController();
  const { signal } = ac;

  let scrollSettle = 0;

  // When the page moves, the overlay's fixed-positioned layer doesn't move with it, so redraw the seams
  const onViewportShift = (): void => {
    if (!renderer.hasLiveGeometry) {
      return;
    }

    if (!layer.dataset.oooShifting) {
      layer.dataset.oooShifting = "on";
    }

    clearTimeout(scrollSettle);
    scrollSettle = window.setTimeout(() => {
      renderer.placeManual();
      delete layer.dataset.oooShifting;
    }, 150);
  };

  let resizeSettle = 0;
  let resizeRaf = 0;

  // Mid-drag, CSS-anchored badges and hops follow their anchors natively; the
  // per-frame pass only re-derives what JS owns (seam boxes, hop quadrant
  // classes), which resize reflow keeps in sync since it happens on the main
  // thread (unlike compositor scroll). The audit is the expensive part and its
  // verdicts only matter once layout stops moving, so it waits for the drag to
  // settle instead of running during it.
  const onResize = (): void => {
    if (renderer.hasLiveGeometry && !resizeRaf) {
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        renderer.placeManual();
      });
    }
    clearTimeout(resizeSettle);
    resizeSettle = window.setTimeout(requestBuild, 150);
  };

  window.addEventListener("resize", onResize, { signal });

  window.addEventListener("scroll", onViewportShift, { capture: true, passive: true, signal });

  // composedPath, not target: focus inside an open shadow root is retargeted to
  // the host by the time it reaches the document.
  const onFocusIn = (event: FocusEvent): void => {
    const target = event.composedPath()[0];
    renderer.setFocused(target instanceof Element ? target : null);
  };

  const onFocusOut = (): void => renderer.setFocused(null);
  document.addEventListener("focusin", onFocusIn, { signal });
  document.addEventListener("focusout", onFocusOut, { signal });

  return () => {
    ac.abort();
    clearTimeout(scrollSettle);
    clearTimeout(resizeSettle);
    cancelAnimationFrame(resizeRaf);
  };
}
