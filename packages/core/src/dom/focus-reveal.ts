/** Properties whose value can flip an element from hidden to visible. */
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
export function focusRevealSelectors(doc: Document): string[] {
  const sheets = [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])];
  return sheets.flatMap((sheet) => {
    try {
      return revealSelectors(sheet.cssRules);
    } catch {
      return [];
    }
  });
}

export function isRevealedOnFocus(element: Element, selectors: string[]): boolean {
  return selectors.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}
