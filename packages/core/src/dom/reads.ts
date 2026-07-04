export interface DomReads {
  style(element: Element): CSSStyleDeclaration;
  rect(element: Element): DOMRect;
}

/** Uncached reads, for callers outside an audit pass. */
export const directReads: DomReads = {
  style: (element) => getComputedStyle(element),
  rect: (element) => element.getBoundingClientRect(),
};

/** Memoized reads for one audit pass. Caching is safe because the audit never
    writes to the DOM mid-pass, so layout is stable for its whole lifetime. */
export function createReads(): DomReads {
  const styles = new Map<Element, CSSStyleDeclaration>();
  const rects = new Map<Element, DOMRect>();
  return {
    style(element) {
      let style = styles.get(element);
      if (!style) {
        style = getComputedStyle(element);
        styles.set(element, style);
      }
      return style;
    },
    rect(element) {
      let rect = rects.get(element);
      if (!rect) {
        rect = element.getBoundingClientRect();
        rects.set(element, rect);
      }
      return rect;
    },
  };
}
