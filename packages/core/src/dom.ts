/** Small DOM helpers. Page-evaluatable: everything here runs against a live DOM. */

// Skip the overlay's own ring/badge classes so they never leak into a selector.
import { OVERLAY_CLASS_PREFIX } from "./overlay-classes.js";

/** Walk up from `start` (inclusive) and return the first ancestor matching
    `test`, or null. Pass `element.parentElement` as `start` to exclude `element` itself. */
function closestAncestor(
  start: Element | null,
  test: (element: Element) => boolean,
): Element | null {
  for (let node = start; node; node = node.parentElement) {
    if (test(node)) {
      return node;
    }
  }
  return null;
}

/** Build a short, readable selector path for messages (not guaranteed unique). */
export function selectorFor(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  let depth = 0;

  while (node && depth < 4) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part += `#${node.id}`;
      parts.unshift(part);

      break;
    }

    const cls = (node.getAttribute("class") || "")
      .trim()
      .split(/\s+/)
      .filter((c) => c && !c.startsWith(OVERLAY_CLASS_PREFIX));

    if (cls.length) {
      part += `.${cls[0]}`;
    }

    parts.unshift(part);
    node = node.parentElement;
    depth++;
  }

  return parts.join(" > ");
}

/** Interactive-widget ARIA roles ("Name From: author required"). Shared by
    isInteractive (name-required) and looksClickable (mouse-only). */
const INTERACTIVE_ROLES = [
  "button",
  "link",
  "checkbox",
  "radio",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "switch",
  "combobox",
  "textbox",
  "searchbox",
  "slider",
  "spinbutton",
  "option",
  "treeitem",
];

/** Elements that need an accessible name to be usable. */
export function isInteractive(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  // An <a> is a link (role=link, focusable) only with an href; without one it has
  // no implicit role and isn't focusable. A href-less <a> may still be interactive
  // via an explicit role, so fall through to the role check rather than returning.
  if (tag === "a" && element.hasAttribute("href")) {
    return true;
  }
  if (["button", "select", "textarea", "summary"].includes(tag)) {
    return true;
  }
  if (tag === "input") {
    const type = (element.getAttribute("type") || "text").toLowerCase();
    return type !== "hidden";
  }
  const role = element.getAttribute("role");
  return !!role && INTERACTIVE_ROLES.includes(role);
}

export function hasExplicitName(element: Element): boolean {
  return (
    (element.getAttribute("aria-label") || "").trim() !== "" ||
    (element.getAttribute("title") || "").trim() !== ""
  );
}

export function inAriaHidden(element: Element): boolean {
  return element.closest('[aria-hidden="true"]') !== null;
}

export function isInert(element: Element): boolean {
  return element.closest("[inert]") !== null;
}

/** Resolved opacity is 0 on the element or any ancestor (so it paints nothing). */
function isTransparent(element: Element): boolean {
  return (
    closestAncestor(
      element,
      (node) => parseFloat(getComputedStyle(node).opacity || "1") === 0,
    ) !== null
  );
}

/** The intentional ".sr-only"/"visually-hidden" utility: tiny + clipped. We must
    NOT flag it as a bug, since it's the standard way to expose text to screen readers. */
function isScreenReaderOnly(element: Element, rect: DOMRect): boolean {
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

/** `element` lies entirely outside an ancestor that clips overflow on that axis, so
    it's visually cut off even though it keeps its place in the tab order. */
function isClipped(element: Element, rect: DOMRect): boolean {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const containerRect = node.getBoundingClientRect();
    if (containerRect.width === 0 && containerRect.height === 0) {
      continue;
    }
    const style = getComputedStyle(node);
    const outX =
      rect.right <= containerRect.left || rect.left >= containerRect.right;
    const outY =
      rect.bottom <= containerRect.top || rect.top >= containerRect.bottom;
    const clipX = style.overflowX === "hidden" || style.overflowX === "clip";
    const clipY = style.overflowY === "hidden" || style.overflowY === "clip";
    if ((outX && clipX) || (outY && clipY)) {
      return true;
    }
  }
  return false;
}

/** Positioned past the page's top-left origin (the classic `left:-9999px` hack).
    Page-relative, not viewport-relative: you can't scroll past 0,0, so only content
    entirely above/left of it is unreachable, not merely scrolled out of view. */
function isOffPage(element: Element, rect: DOMRect): boolean {
  const win = element.ownerDocument?.defaultView;
  if (!win) {
    return false;
  }
  const pageRight = rect.right + win.scrollX;
  const pageBottom = rect.bottom + win.scrollY;
  return pageRight <= 0 || pageBottom <= 0;
}

/**
 * Why a tab stop is effectively invisible while still being tabbable, or null if
 * it's genuinely perceivable. Skips the intentional screen-reader-only pattern.
 */
export function hiddenReason(element: Element, rect: DOMRect): string | null {
  if (isScreenReaderOnly(element, rect)) {
    return null;
  }
  // An <area> has no box of its own; its hit region lives on the associated
  // <img usemap>, so getBoundingClientRect() is always 0×0 and would trip the
  // zero-size check below. tabbable already gates an area on its image's
  // visibility, so an area that's in the sequence is perceivable; never flag it.
  if (element.tagName.toLowerCase() === "area") {
    return null;
  }
  if (isTransparent(element)) {
    return "opacity:0, invisible but still tabbable";
  }
  if (rect.width < 1 || rect.height < 1) {
    return "zero size, no visible target";
  }
  if (isOffPage(element, rect)) {
    return "positioned off-screen (e.g. left:-9999px), invisible but still tabbable";
  }
  if (isClipped(element, rect)) {
    return "clipped by an overflow:hidden ancestor";
  }
  return null;
}

/** Native HTML elements that are interactive (and focusable) on their own. A role
    on one of these is at most redundant, never a reimplementation, so they're the
    elements `looksClickable`/`nativeReplacement` skip. */
const NATIVE_INTERACTIVE_TAGS = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "option",
];

/** Looks interactive (an interactive role or an inline click handler) but is not
    a natively focusable element, the signature of a mouse-only control. */
export function looksClickable(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (NATIVE_INTERACTIVE_TAGS.includes(tag)) {
    return false;
  }
  const role = element.getAttribute("role");
  if (role && INTERACTIVE_ROLES.includes(role)) {
    return true;
  }
  return element.hasAttribute("onclick");
}

/** The native HTML element each ARIA role reimplements, when one exists. Roles
    with no native equivalent (menuitem, tab, treeitem, …) are intentionally
    absent: those are legitimate custom widgets, not controls to swap out. */
const NATIVE_FOR_ROLE: Record<string, string> = {
  button: "<button>",
  link: "<a href>",
  checkbox: '<input type="checkbox">',
  radio: '<input type="radio">',
  switch: '<input type="checkbox" role="switch">',
  slider: '<input type="range">',
  spinbutton: '<input type="number">',
  searchbox: '<input type="search">',
  textbox: "<input> or <textarea>",
  combobox: "<select>",
  option: "<option>",
};

/** If `element` reimplements a native control via an interactive role on a generic
    tag, the native element to use instead; else null. Native interactive tags (and a
    merely-redundant role on one) return null; there's nothing to swap. */
export function nativeReplacement(element: Element): string | null {
  if (NATIVE_INTERACTIVE_TAGS.includes(element.tagName.toLowerCase())) {
    return null;
  }
  const role = element.getAttribute("role");
  if (!role) {
    return null;
  }
  return NATIVE_FOR_ROLE[role] ?? null;
}

/** Elements that are focusable on their own, before any tabindex, mirroring the
    native-focusable set the HTML spec defines (sans the tabindex attribute) */
export function isNativelyFocusable(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === "a" || tag === "area") {
    return element.hasAttribute("href");
  }

  if (["button", "select", "textarea", "iframe"].includes(tag)) {
    return true;
  }

  if (tag === "input") {
    return (element.getAttribute("type") || "text").toLowerCase() !== "hidden";
  }

  if (tag === "audio" || tag === "video") {
    return element.hasAttribute("controls");
  }

  if (tag === "summary") {
    // Only the first <summary> child of a <details> is focusable.
    const parent = element.parentElement;
    return (
      parent?.tagName.toLowerCase() === "details" &&
      parent.querySelector("summary") === element
    );
  }
  return false;
}

const COMPOSITE_ROLES = [
  "toolbar",
  "tablist",
  "menu",
  "menubar",
  "radiogroup",
  "listbox",
  "tree",
  "grid",
];

/** The nearest ancestor that is a composite widget (per ARIA, these should expose
    a single tab stop and move between items with the arrow keys). */
export function compositeAncestor(element: Element): Element | null {
  return closestAncestor(element.parentElement, (node) => {
    const role = node.getAttribute("role");

    return !!role && COMPOSITE_ROLES.includes(role);
  });
}

/** Reachable by keyboard via something other than Tab (negative/roving tabindex, an
    aria-activedescendant ancestor, or a composite widget), so it's deliberately out
    of the Tab sequence, not unreachable. Read the tabindex *attribute*, not the
    .tabIndex IDL property, which is -1 for everything non-focusable. */
export function isFocusManaged(element: Element): boolean {
  const tabindex = element.getAttribute("tabindex");
  if (tabindex !== null && Number(tabindex) < 0) {
    return true;
  }
  if (compositeAncestor(element)) {
    return true;
  }
  return element.closest("[aria-activedescendant]") !== null;
}

/** The nearest fixed/sticky ancestor-or-self: the scroll-detached "chrome" layer
    (sticky navbar, fixed header) the element rides in, or null if it sits in
    normal flow. */
export function floatingAncestor(element: Element): Element | null {
  return closestAncestor(element, (node) => {
    const pos = getComputedStyle(node).position;

    return pos === "fixed" || pos === "sticky";
  });
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

/** The nearest ancestor that independently scrolls `element` (excluding itself), or
    null if it only rides the document scroll. Two stops with different scroll
    ancestors don't share a scroll context, so the visual-order check skips the pair
    (their on-screen relationship moves with the scrollbar). */
export function scrollAncestor(element: Element): Element | null {
  return closestAncestor(element.parentElement, isScrollContainer);
}

/** Whether `element` is actually rendered, so a modal toggled shut with `hidden` or
    `display:none` doesn't count as open (its background would otherwise be flagged
    as leaking focus while nothing is on screen). */
function isDisplayed(element: Element): boolean {
  const check = (element as HTMLElement).checkVisibility;
  if (typeof check === "function") {
    return check.call(element, { visibilityProperty: true });
  }
  // Fallback for engines without checkVisibility: walk the display chain.
  return (
    closestAncestor(
      element,
      (node) => getComputedStyle(node).display === "none",
    ) === null
  );
}

/** The first genuinely-modal, on-screen container in `root`: a `<dialog>:modal`
    (opened via showModal()) or an `aria-modal="true"` element. Non-modal dialogs
    (show() or a bare `open`) and hidden ones are excluded, since their background is
    meant to stay interactive. */
export function openModal(root: ParentNode): Element | null {
  for (const element of root.querySelectorAll(
    'dialog:modal, [aria-modal="true"]',
  )) {
    if (isDisplayed(element)) {
      return element;
    }
  }
  return null;
}
