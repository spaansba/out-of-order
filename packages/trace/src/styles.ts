import { OVERLAY_CSS } from "./css/overlay.js";
import { RING_CSS } from "./css/ring.js";
import { PANEL_CSS } from "./css/panel.js";
import { TIP_CSS } from "./css/tip.js";
import { ISSUE_CSS } from "./css/issue.js";

// The full overlay sheet is the concatenation of the component sheets. Each
// targets a disjoint `.ooo-*` namespace (badge/hop, panel, tip, issue) and rings
// key on an attribute, so their order in the sheet is cascade-independent.
const overlaySheet = new CSSStyleSheet();
overlaySheet.replaceSync(OVERLAY_CSS + RING_CSS + PANEL_CSS + TIP_CSS + ISSUE_CSS);

const ringSheet = new CSSStyleSheet();
ringSheet.replaceSync(RING_CSS);

const issueSheet = new CSSStyleSheet();
issueSheet.replaceSync(ISSUE_CSS);

function adopt(root: DocumentOrShadowRoot, sheet: CSSStyleSheet): void {
  if (root.adoptedStyleSheets.includes(sheet)) {
    return;
  }

  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

/** Make the full overlay stylesheet available on the document. */
export function ensureStyles(): void {
  adopt(document, overlaySheet);
}

export function ensureIssueStyles(): void {
  adopt(document, issueSheet);
}

/** Anchor rules are per trace instance, not module state: the page's overlay
    and the extension's can briefly coexist around a takeover, and a shared
    sheet would let one wipe the other's anchors on clear. */
export function createAnchorSheet(): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  adopt(document, sheet);
  return sheet;
}

export function releaseAnchorSheet(sheet: CSSStyleSheet): void {
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((other) => other !== sheet);
}

// Attribute-keyed rules rather than inline styles, so the page's style
// attributes stay untouched (mirrors the data-ooo-ring pattern). Each id also
// gets a ::part selector: shadow elements carry a part token instead of the
// attribute, which is the one way a document-scope rule (and so the layer's
// anchor() refs) can name an element across a shadow boundary.
export function setAnchorRules(sheet: CSSStyleSheet, token: number, count: number): void {
  sheet.replaceSync(
    Array.from({ length: count }, (_, id) => {
      const key = `${token}-${id}`;
      return `[data-ooo-anchor="${key}"], ::part(ooo-${key}) { anchor-name: --ooo-${key}; }`;
    }).join("\n"),
  );
}

/** Mirror just the ring rules into a shadow root (document styles don't cross
    the boundary), so a ringed element inside it still gets its outline. */
export function ensureRingStyles(root: ShadowRoot): void {
  adopt(root, ringSheet);
}
