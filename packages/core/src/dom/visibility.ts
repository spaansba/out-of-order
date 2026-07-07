import { closestAncestor } from "./composed-tree.js";
import { directReads, type DomReads } from "./reads.js";

/** The intentional ".sr-only"/"visually-hidden" utility: tiny + clipped. We must
    NOT flag it as a bug, since it's the standard way to expose text to screen readers. */
export function isScreenReaderOnly(
  element: Element,
  rect?: DOMRect,
  reads: DomReads = directReads,
): boolean {
  const box = rect ?? reads.rect(element);
  if (box.width > 2 || box.height > 2) {
    return false;
  }
  const style = reads.style(element);
  return (
    (style.clip !== "" && style.clip !== "auto") ||
    (style.clipPath !== "" && style.clipPath !== "none") ||
    style.overflow === "hidden"
  );
}

/** Whether `element` is actually rendered: not `display:none` (or the `hidden`
    attribute) anywhere in its chain and not `visibility:hidden`. Prefers the native
    checkVisibility(), falling back to computed styles on engines that lack it. */
export function isDisplayed(element: Element, reads: DomReads = directReads): boolean {
  const check = (element as HTMLElement).checkVisibility;
  if (typeof check === "function") {
    return check.call(element, { visibilityProperty: true });
  }
  return (
    reads.style(element).visibility === "visible" &&
    closestAncestor(element, (node) => reads.style(node).display === "none") === null
  );
}

export function inAriaHidden(element: Element): boolean {
  return closestAncestor(element, (node) => node.getAttribute("aria-hidden") === "true") !== null;
}

export function isInert(element: Element): boolean {
  return closestAncestor(element, (node) => node.hasAttribute("inert")) !== null;
}

/** A keyboard-scrollable region: computed overflow is auto/scroll on either axis.
    Keys on computed overflow, not a live scrollWidth>clientWidth test, so a
    scrollable box isn't missed just because its content currently fits. */
export function isScrollContainer(element: Element, reads: DomReads = directReads): boolean {
  const scrollable = (value: string) =>
    value === "auto" || value === "scroll" || value === "overlay";
  const style = reads.style(element);
  return scrollable(style.overflowX) || scrollable(style.overflowY);
}

/** The nearest fixed/sticky ancestor-or-self: the scroll-detached "chrome" layer
    (sticky navbar, fixed header) the element rides in, or null if it sits in
    normal flow. */
export function floatingAncestor(element: Element, reads: DomReads = directReads): Element | null {
  return closestAncestor(element, (node) => {
    const pos = reads.style(node).position;
    return pos === "fixed" || pos === "sticky";
  });
}
