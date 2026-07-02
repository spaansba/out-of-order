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

    const cls = (node.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean);

    if (cls.length) {
      part += `.${cls[0]}`;
    }

    // Same-tag siblings would otherwise all render the same path, making messages
    // like "button comes after button" unactionable.
    const tag = node.tagName;
    const sameTag = node.parentElement
      ? Array.from(node.parentElement.children).filter((child) => child.tagName === tag)
      : [];
    if (sameTag.length > 1) {
      part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }

    parts.unshift(part);
    node = node.parentElement;
    depth++;
  }

  return parts.join(" > ");
}
