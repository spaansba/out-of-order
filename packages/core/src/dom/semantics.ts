import { closestAncestor, composedParent } from "./composed-tree.js";

/** The native HTML element each interactive ARIA role reimplements, when one
    exists. Roles with no native equivalent live in COMPOSITE_ROLES_NO_NATIVE. */
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

/** Interactive roles with no native HTML equivalent: legitimate custom widgets,
    not controls to swap out (so absent from NATIVE_FOR_ROLE). */
const COMPOSITE_ROLES_NO_NATIVE = [
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "treeitem",
];

const INTERACTIVE_ROLES = [...Object.keys(NATIVE_FOR_ROLE), ...COMPOSITE_ROLES_NO_NATIVE];

/** The role attribute is a space-separated fallback list; the first token wins. */
export function explicitRole(element: Element): string | null {
  return element.getAttribute("role")?.trim().split(/\s+/)[0] || null;
}

function isContentEditingHost(element: Element): boolean {
  const value = element.getAttribute("contenteditable")?.toLowerCase();

  return value === "" || value === "true" || value === "plaintext-only";
}

export function isInteractive(element: Element): boolean {
  if (isContentEditingHost(element)) {
    return true;
  }

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
  const role = explicitRole(element);
  return !!role && INTERACTIVE_ROLES.includes(role);
}

/** Roles that don't justify a tab stop: presentation/none strip semantics, the rest
    describe static content or structure. Interactive roles are cleared by
    isInteractive, and focusable-container roles (e.g. tabpanel) are deliberately
    absent, so a tabindex="0" on one of these is a dead stop in the tab order. */
const NONINTERACTIVE_ROLES = [
  "presentation",
  "none",
  "note",
  "article",
  "definition",
  "term",
  "heading",
  "img",
  "math",
  "list",
  "listitem",
  "figure",
  "caption",
  "paragraph",
  "mark",
  "blockquote",
  "code",
  "emphasis",
  "strong",
  "insertion",
  "deletion",
  "subscript",
  "superscript",
  "time",
  "directory",
  "separator",
  "tooltip",
  "status",
  "alert",
  "log",
  "timer",
  "marquee",
];

export function isNoninteractiveRole(role: string): boolean {
  return NONINTERACTIVE_ROLES.includes(role);
}

export function hasExplicitName(element: Element): boolean {
  return (
    (element.getAttribute("aria-label") || "").trim() !== "" ||
    (element.getAttribute("title") || "").trim() !== ""
  );
}

/** Native HTML elements that are interactive (and focusable) on their own. A role
    on one of these is at most redundant, never a reimplementation, so they're the
    elements `looksClickable`/`nativeReplacement` skip. */
const NATIVE_INTERACTIVE_TAGS = ["button", "input", "select", "textarea", "summary", "option"];

function isNativeInteractiveTag(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === "a") {
    return element.hasAttribute("href");
  }

  return NATIVE_INTERACTIVE_TAGS.includes(tag);
}

/** Looks interactive (an interactive role or an inline click handler) but is not
    a natively focusable element, the signature of a mouse-only control. */
export function looksClickable(element: Element): boolean {
  if (isNativeInteractiveTag(element)) {
    return false;
  }
  const role = explicitRole(element);
  if (role && INTERACTIVE_ROLES.includes(role)) {
    return true;
  }
  return element.hasAttribute("onclick");
}

export function isAriaDisabled(element: Element): boolean {
  return element.getAttribute("aria-disabled") === "true";
}

/** If `element` reimplements a native control via an interactive role on a generic
    tag, the native element to use instead; else null. Native interactive tags (and a
    merely-redundant role on one) return null; there's nothing to swap. */
export function nativeReplacement(element: Element): string | null {
  if (isNativeInteractiveTag(element)) {
    return null;
  }
  const role = explicitRole(element);
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
      parent.querySelector(":scope > summary") === element
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
  "treegrid",
];

/** The nearest ancestor that is a composite widget (per ARIA, these should expose
    a single tab stop and move between items with the arrow keys). */
export function compositeAncestor(element: Element): Element | null {
  return closestAncestor(composedParent(element), (node) => {
    const role = explicitRole(node);

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
  return closestAncestor(element, (node) => node.hasAttribute("aria-activedescendant")) !== null;
}
