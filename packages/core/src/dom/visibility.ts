import { closestAncestor, composedParent } from "./composed-tree.js";
import { directReads, type DomReads } from "./reads.js";

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

function isTransparent(element: Element, reads: DomReads): boolean {
  const check = (element as HTMLElement).checkVisibility;
  if (typeof check === "function") {
    return !check.call(element, { opacityProperty: true });
  }
  return (
    closestAncestor(element, (node) => parseFloat(reads.style(node).opacity || "1") === 0) !== null
  );
}

function hasZeroOpacityFilter(element: Element, reads: DomReads): boolean {
  return (
    closestAncestor(element, (node) => {
      const value = /opacity\(([^)]+)\)/.exec(reads.style(node).filter)?.[1];
      return value !== undefined && parseFloat(value) === 0;
    }) !== null
  );
}

function hasEmptyClip(element: Element, reads: DomReads): boolean {
  const style = reads.style(element);
  if (style.position !== "absolute" && style.position !== "fixed") {
    return false;
  }
  const match = /rect\(([^)]+)\)/.exec(style.clip);
  if (!match) {
    return false;
  }
  const [top = NaN, right = NaN, bottom = NaN, left = NaN] = match[1]!
    .split(/[,\s]+/)
    .map((part) => parseFloat(part));
  return right <= left || bottom <= top;
}

function isClipped(element: Element, rect: DOMRect, reads: DomReads): boolean {
  for (let node = composedParent(element); node; node = composedParent(node)) {
    const containerRect = reads.rect(node);
    if (containerRect.width === 0 && containerRect.height === 0) {
      continue;
    }
    const style = reads.style(node);
    const outX = rect.right <= containerRect.left || rect.left >= containerRect.right;
    const outY = rect.bottom <= containerRect.top || rect.top >= containerRect.bottom;
    const clipX = style.overflowX === "clip";
    const clipY = style.overflowY === "clip";
    if ((outX && clipX) || (outY && clipY)) {
      return true;
    }
  }
  return false;
}

function isOffPage(element: Element, rect: DOMRect, reads: DomReads): boolean {
  const win = element.ownerDocument?.defaultView;
  if (!win) {
    return false;
  }
  if (rect.bottom + win.scrollY <= 0) {
    return true;
  }
  const root = element.ownerDocument.documentElement;
  return reads.style(root).direction === "rtl"
    ? rect.left + win.scrollX >= root.clientWidth
    : rect.right + win.scrollX <= 0;
}

export function hiddenReason(
  element: Element,
  rect: DOMRect,
  reads: DomReads = directReads,
): string | null {
  if (isScreenReaderOnly(element, rect, reads)) {
    return null;
  }
  if (element.tagName.toLowerCase() === "area") {
    return null;
  }
  if (isTransparent(element, reads)) {
    return "opacity:0, invisible but still tabbable";
  }
  if (hasZeroOpacityFilter(element, reads)) {
    return "filter:opacity(0), invisible but still tabbable";
  }
  if (hasEmptyClip(element, reads)) {
    return "clipped to nothing by clip:rect()";
  }
  if (rect.width < 1 || rect.height < 1) {
    return "zero size, no visible target";
  }
  if (isOffPage(element, rect, reads)) {
    return "positioned off-screen (e.g. left:-9999px), invisible but still tabbable";
  }
  if (isClipped(element, rect, reads)) {
    return "clipped by an overflow:clip ancestor";
  }
  return null;
}
