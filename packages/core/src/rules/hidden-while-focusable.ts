import { closestAncestor, composedParent, isScreenReaderOnly } from "../dom/index.js";
import { flagEntries, type RuleDef } from "./rule.js";

/** Resolved opacity is 0 on the element or any ancestor (so it paints nothing).
    Prefers the native checkVisibility() (which folds in the opacity chain), falling
    back to walking the ancestors on engines that lack it. */
function isTransparent(element: Element): boolean {
  const check = (element as HTMLElement).checkVisibility;
  if (typeof check === "function") {
    return !check.call(element, { opacityProperty: true });
  }
  return (
    closestAncestor(element, (node) => parseFloat(getComputedStyle(node).opacity || "1") === 0) !==
    null
  );
}

/** filter:opacity(0) on the element or an ancestor paints the whole subtree
    invisible, but checkVisibility's opacityProperty only folds in the opacity
    property, so the filter chain needs its own walk. */
function hasZeroOpacityFilter(element: Element): boolean {
  return (
    closestAncestor(element, (node) => {
      const value = /opacity\(([^)]+)\)/.exec(getComputedStyle(node).filter)?.[1];
      return value !== undefined && parseFloat(value) === 0;
    }) !== null
  );
}

/** clip:rect() that leaves no visible region (right<=left or bottom<=top). The
    border box keeps its full size, so the zero-size check never sees this. Clip
    only applies to absolutely positioned elements. */
function hasEmptyClip(element: Element): boolean {
  const style = getComputedStyle(element);
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

/** `element` lies entirely outside an ancestor that clips it away for good on that
    axis. Only `overflow:clip` counts: it establishes no scroll container, so the
    element can never be brought into view. `overflow:hidden` is a scroll container
    the browser scrolls to reveal a focused descendant, so it isn't a dead end and is
    excluded here (see the reveal-on-focus handling in `hiddenReason`). */
function isClipped(element: Element, rect: DOMRect): boolean {
  for (let node = composedParent(element); node; node = composedParent(node)) {
    const containerRect = node.getBoundingClientRect();
    if (containerRect.width === 0 && containerRect.height === 0) {
      continue;
    }
    const style = getComputedStyle(node);
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

/** Positioned past the page's start edges (the classic `left:-9999px` hack, or
    `right:-9999px` in an RTL document). Page-relative, not viewport-relative: the
    page can't scroll before its top or inline-start edge, so only content entirely
    past those is unreachable. Overflow past the inline-END edge is scrollable (the
    browser reveals it when the element gains focus), so which horizontal side is a
    dead end follows the document's direction. */
function isOffPage(element: Element, rect: DOMRect): boolean {
  const win = element.ownerDocument?.defaultView;
  if (!win) {
    return false;
  }
  if (rect.bottom + win.scrollY <= 0) {
    return true;
  }
  const root = element.ownerDocument.documentElement;
  return getComputedStyle(root).direction === "rtl"
    ? rect.left + win.scrollX >= root.clientWidth
    : rect.right + win.scrollX <= 0;
}

/** Why `element` is invisible given a single measured `rect`, or null if it's
    perceivable. Reads only the state as measured; the focus-reveal check lives in
    `hiddenReason`. Skips the intentional screen-reader-only pattern. */
function staticHiddenReason(element: Element, rect: DOMRect): string | null {
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
  if (hasZeroOpacityFilter(element)) {
    return "filter:opacity(0), invisible but still tabbable";
  }
  if (hasEmptyClip(element)) {
    return "clipped to nothing by clip:rect()";
  }
  if (rect.width < 1 || rect.height < 1) {
    return "zero size, no visible target";
  }
  if (isOffPage(element, rect)) {
    return "positioned off-screen (e.g. left:-9999px), invisible but still tabbable";
  }
  if (isClipped(element, rect)) {
    return "clipped by an overflow:clip ancestor";
  }
  return null;
}

/** Properties whose value can flip an element from hidden to visible. A focus rule
    that touches one of these can reveal the element; a focus rule that only tweaks
    e.g. `outline` or `color` cannot, so it must not exonerate a hidden control. */
const REVEALING_PROPS = [
  "opacity",
  "visibility",
  "display",
  "position",
  "left",
  "right",
  "top",
  "bottom",
  "inset",
  "clip",
  "clip-path",
  "filter",
  "transform",
  "translate",
  "scale",
  "width",
  "height",
  "max-width",
  "max-height",
  "overflow",
];

/** A nested rule's selectorText keeps the `&` (or implies one), which outside its
    stylesheet means `:scope` and would match anything. Substitute the parent
    selector back in so the result stands alone in `Element.matches()`. */
function resolveNested(selectorList: string, parent: string | null): string {
  if (!parent) {
    return selectorList;
  }
  const scope = `:is(${parent})`;
  // No `&` in a nested rule implies descendant scoping. Wrapping the whole list in
  // :is() keeps any commas in it intact without parsing the selector.
  return selectorList.includes("&")
    ? selectorList.replace(/&/g, scope)
    : `${scope} :is(${selectorList})`;
}

function revealSelectors(rules: CSSRuleList, parent: string | null = null): string[] {
  return Array.from(rules).flatMap((rule) => {
    if (rule instanceof CSSStyleRule) {
      // The resolved selector carries focus pseudos from ancestor rules too, so a
      // nested `& .child` under `.nav:focus-within` still qualifies.
      const resolved = resolveNested(rule.selectorText, parent);
      const own: string[] = [];
      if (
        /:focus/i.test(resolved) &&
        REVEALING_PROPS.some((p) => rule.style.getPropertyValue(p) !== "")
      ) {
        // Drop the focus pseudos so the selector matches the element at rest: what
        // it looks like *before* focus is what we're grading against.
        const resting = resolved.replace(/:focus(?:-visible|-within)?/gi, "").trim();
        if (resting) {
          own.push(resting);
        }
      }
      // A CSSStyleRule also exposes cssRules (CSS nesting); descend with this
      // rule's resolved selector as the new nesting context.
      const nested =
        "cssRules" in rule ? revealSelectors((rule as CSSGroupingRule).cssRules, resolved) : [];
      return [...own, ...nested];
    }
    return "cssRules" in rule ? revealSelectors((rule as CSSGroupingRule).cssRules, parent) : [];
  });
}

/**
 * The resting-state selectors of every readable stylesheet rule that keys on focus
 * *and* sets a property that could reveal a hidden element. A hidden tab stop that
 * matches one of these is the reveal-on-focus pattern (skip links, on-focus
 * controls), visible exactly when a keyboard user reaches it, so it isn't a bug.
 */
function focusRevealSelectors(doc: Document): string[] {
  const sheets = [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])];
  return sheets.flatMap((sheet) => {
    try {
      return revealSelectors(sheet.cssRules);
    } catch {
      return [];
    }
  });
}

/**
 * Why a tab stop is effectively invisible while still being tabbable, or null if
 * it's genuinely perceivable. A control hidden at rest but revealed when it
 * receives focus (the skip-link / reveal-on-focus pattern) is perceivable exactly
 * when a keyboard user reaches it, so it's exonerated. Pass `revealOnFocus` from
 * {@link focusRevealSelectors} to enable that exemption.
 */
function hiddenReason(element: Element, rect: DOMRect, revealOnFocus: string[]): string | null {
  const reason = staticHiddenReason(element, rect);
  if (!reason) {
    return null;
  }
  // Hidden at rest, but a focus rule reveals it: not a bug. A stripped selector can
  // be invalid (e.g. an emptied :not()), which matches nothing and exonerates nothing.
  const revealed = revealOnFocus.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
  return revealed ? null : reason;
}

export const hiddenWhileFocusable: RuleDef = {
  docs: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
  severity: "error",
  run: (sequence, { container }) => {
    // Scan the page's focus-reveal rules once, not per element.
    const revealOnFocus = focusRevealSelectors(container.ownerDocument);
    return flagEntries(sequence, (entry) => {
      const reason = hiddenReason(entry.element, entry.rect, revealOnFocus);
      return reason
        ? {
            message: `"${entry.selector}" is tabbable but ${reason}.`,
            fix: `Hide it from the tab order too (display:none, the hidden attribute, or tabindex="-1"). If it's revealed on :hover, reveal it on :focus as well so keyboard users can see it.`,
          }
        : null;
    });
  },
};
