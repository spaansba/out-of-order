import { closestAncestor } from "./composed-tree.js";

/** The intentional ".sr-only"/"visually-hidden" utility: tiny + clipped. We must
    NOT flag it as a bug, since it's the standard way to expose text to screen readers. */
export function isScreenReaderOnly(
  element: Element,
  rect: DOMRect = element.getBoundingClientRect(),
): boolean {
  if (rect.width > 2 || rect.height > 2) {
    return false;
  }
  const style = getComputedStyle(element);
  return (
    (style.clip !== "" && style.clip !== "auto") ||
    (style.clipPath !== "" && style.clipPath !== "none") ||
    style.overflow === "hidden"
  );
}

/** Whether `element` is actually rendered: not `display:none` (or the `hidden`
    attribute) anywhere in its chain and not `visibility:hidden`. Prefers the native
    checkVisibility(), falling back to computed styles on engines that lack it. */
export function isDisplayed(element: Element): boolean {
  const check = (element as HTMLElement).checkVisibility;
  if (typeof check === "function") {
    return check.call(element, { visibilityProperty: true });
  }
  return (
    getComputedStyle(element).visibility === "visible" &&
    closestAncestor(element, (node) => getComputedStyle(node).display === "none") === null
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
export function isScrollContainer(element: Element): boolean {
  const scrollable = (value: string) =>
    value === "auto" || value === "scroll" || value === "overlay";
  const style = getComputedStyle(element);
  return scrollable(style.overflowX) || scrollable(style.overflowY);
}
