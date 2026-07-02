/** `element`'s parent in the composed tree: the light-DOM parent, or the shadow
    host when `element` is a top-level child of a shadow root. The tab sequence
    pierces open shadow roots (tabbable's getShadowRoot), so ancestor walks must
    hop the same boundary or shadow content escapes every ancestor-based rule. */
export function composedParent(element: Element): Element | null {
  if (element.parentElement) {
    return element.parentElement;
  }
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/** Walk up from `start` (inclusive) through the composed tree (crossing shadow
    boundaries) and return the first ancestor matching `test`, or null. Pass
    `composedParent(element)` as `start` to exclude `element` itself. */
export function closestAncestor(
  start: Element | null,
  test: (element: Element) => boolean,
): Element | null {
  for (let node = start; node; node = composedParent(node)) {
    if (test(node)) {
      return node;
    }
  }
  return null;
}

/** Every element under `root` in tree order, descending into open shadow roots
    (closed ones stay opaque, same as the tab sequence). The composed-tree
    stand-in for `root.querySelectorAll("*")`, which never enters a shadow root. */
export function* composedDescendants(root: ParentNode): Generator<Element> {
  if (root instanceof Element && root.shadowRoot) {
    yield* composedDescendants(root.shadowRoot);
  }
  for (const element of root.querySelectorAll("*")) {
    yield element;
    if (element.shadowRoot) {
      yield* composedDescendants(element.shadowRoot);
    }
  }
}

/** Composed-tree contains(): whether `node` is `ancestor` or sits anywhere below
    it, crossing shadow boundaries. Node.contains() treats shadow content as
    outside its host, so a modal's own shadow controls would read as leaked. */
export function containsComposed(ancestor: Element, node: Element): boolean {
  return closestAncestor(node, (candidate) => candidate === ancestor) !== null;
}
