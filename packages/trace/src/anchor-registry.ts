import { createAnchorSheet, releaseAnchorSheet, setAnchorRules } from "./styles.js";
import { needsManualPlacement } from "./util.js";
import type { StopSpec } from "./specs.js";

// An attribute on page elements, not a class, so the analyzer's selectors never
// see the overlay's own markup.
const ANCHOR_ATTR = "data-ooo-anchor";

/** Owns the CSS anchor names the overlay positions against: which page elements
    carry one, and the stylesheet slot that declares them. The shadow-DOM
    part/exportparts path is the subtlest code here: ::part is the one way a
    document-scope rule can put an anchor name on a shadow element. */
export class AnchorRegistry {
  private anchored: { element: Element; exported: Element[] }[] = [];
  private readonly anchorSheet = createAnchorSheet();
  private readonly token = nextInstanceToken();

  /** Reuse an anchor name if element already has one there, else use our own */
  public resolveAnchorNames(stops: StopSpec[]): Map<Element, string> {
    const names = new Map<Element, string>();
    for (const stop of stops) {
      if (needsManualPlacement(stop.element)) {
        continue;
      }

      if (stop.element.getRootNode() instanceof ShadowRoot) {
        continue;
      }

      const existing = getComputedStyle(stop.element).getPropertyValue("anchor-name");

      if (existing && existing !== "none") {
        const name = existing.split(",")[0]!.trim();

        if (!name.startsWith("--ooo-")) {
          names.set(stop.element, name);
        }
      }
    }

    return names;
  }

  /** Generate and publish an anchor name for every stop that didn't already
      have one, then install the matching anchor rules. */
  public publishAnchors(stops: StopSpec[], names: Map<Element, string>): void {
    for (const stop of stops) {
      if (needsManualPlacement(stop.element)) {
        continue;
      }
      if (!names.has(stop.element)) {
        names.set(stop.element, this.publishAnchor(stop.element));
      }
    }

    setAnchorRules(this.anchorSheet, this.token, this.anchored.length);
  }

  public clear(): void {
    this.anchored.forEach(({ element, exported }, id) => {
      const key = `${this.token}-${id}`;

      if (element.getAttribute(ANCHOR_ATTR) === key) {
        element.removeAttribute(ANCHOR_ATTR);
      }
      element.part.remove(`ooo-${key}`);
      for (const host of exported) {
        removeExportPart(host, `ooo-${key}`);
      }
    });
    this.anchored = [];
    setAnchorRules(this.anchorSheet, this.token, 0);
  }

  /** Gives the document its stylesheet slot back; the registry is unusable
      afterwards. */
  public dispose(): void {
    releaseAnchorSheet(this.anchorSheet);
  }

  /** Publish --ooo-N for an element so the layer can anchor to it. Light DOM:
      an attribute the generated rule keys on. Shadow DOM: a part token (plus
      exportparts through any nested hosts), since ::part is the one way a
      document-scope rule can put an anchor name on a shadow element. */
  private publishAnchor(element: Element): string {
    const key = `${this.token}-${this.anchored.length}`;
    const exported: Element[] = [];
    const root = element.getRootNode();
    if (root instanceof ShadowRoot) {
      element.part.add(`ooo-${key}`);
      // ::part reaches one boundary; re-export through nested hosts above.
      let host = root.host;
      let hostRoot = host.getRootNode();
      while (hostRoot instanceof ShadowRoot) {
        appendExportPart(host, `ooo-${key}`);
        exported.push(host);
        host = hostRoot.host;
        hostRoot = host.getRootNode();
      }
    } else {
      element.setAttribute(ANCHOR_ATTR, key);
    }
    this.anchored.push({ element, exported });
    return `--ooo-${key}`;
  }
}

function nextInstanceToken(): number {
  const shared = globalThis as { __oooAnchorToken?: number };
  shared.__oooAnchorToken = (shared.__oooAnchorToken ?? 0) + 1;
  return shared.__oooAnchorToken;
}

// exportparts is a plain comma-separated attribute (no token list API), so the
// page's own entries must be preserved around ours.
function appendExportPart(host: Element, token: string): void {
  const current = host.getAttribute("exportparts");
  host.setAttribute("exportparts", current ? `${current}, ${token}` : token);
}

function removeExportPart(host: Element, token: string): void {
  const rest = (host.getAttribute("exportparts") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry && entry !== token);
  if (rest.length) {
    host.setAttribute("exportparts", rest.join(", "));
  } else {
    host.removeAttribute("exportparts");
  }
}
