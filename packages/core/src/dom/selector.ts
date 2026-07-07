/** Build a short, readable selector path for messages (not guaranteed unique). */
export function selectorFor(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  let depth = 0;

  while (node && depth < 4) {
    const tag = node.tagName;
    let part = tag.toLowerCase();
    if (node.id) {
      parts.unshift(`${part}#${node.id}`);

      break;
    }

    const cls = (node.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean)[0];

    if (cls) {
      part += `.${cls}`;
    }

    // Same-tag siblings would otherwise all render the same path, making messages
    // like "button comes after button" unactionable. Walk the siblings directly
    // rather than materializing and filtering the whole child list per node.
    let index = 1;
    let hasSibling = false;
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === tag) {
        index++;
        hasSibling = true;
      }
    }
    for (let sib = node.nextElementSibling; sib && !hasSibling; sib = sib.nextElementSibling) {
      if (sib.tagName === tag) {
        hasSibling = true;
      }
    }
    if (hasSibling) {
      part += `:nth-of-type(${index})`;
    }

    parts.unshift(part);
    node = node.parentElement;
    depth++;
  }

  return parts.join(" > ");
}
