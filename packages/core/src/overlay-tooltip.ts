/** Tooltip content, either ready-made or built on first hover (so a redraw doesn't
    pay for HTML the pointer never opens). */
export type Tip = string | (() => string);

/** Resolve a Tip once and memoize. */
function resolver(tip: Tip): () => string {
  let html: string | null = typeof tip === "string" ? tip : null;
  return () => (html ??= (tip as () => string)());
}

// Detail tooltip. A `popover="manual"` element (top layer, so no z-index wars),
// positioned via CSS anchor positioning (see `.fp-tip`) against a real page
// element so it tracks scrolling. SVG badges/lines can't be anchors, so the
// hover target and the anchor are passed separately.
export class Tooltip {
  private readonly element: HTMLDivElement;
  // A 0x0 point we slide to the cursor; hop tooltips anchor to it so they pop by
  // the pointer rather than at a fixed end of a (possibly long) line.
  private readonly cursor: HTMLDivElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private anchored: Element | null = null;
  // Grace period for the cursor to travel from the target into the tooltip.
  private static readonly HIDE_DELAY = 150;
  // Only one element wears this at a time, or the tooltip tethers to the last.
  private static readonly ANCHOR_NAME = "--fp-tip-anchor";

  constructor(parent: HTMLElement) {
    // Appended before the tooltip: an anchor must precede the element it positions.
    this.cursor = document.createElement("div");
    this.cursor.className = "fp-tip-cursor";
    parent.appendChild(this.cursor);

    this.element = document.createElement("div");
    this.element.className = "fp-tip";
    this.element.setAttribute("popover", "manual");
    parent.appendChild(this.element);

    // Wired once (not per target) so they don't accumulate. Hovering the tooltip
    // keeps it open for selecting/copying; leaving it schedules the hide.
    this.element.addEventListener("mouseenter", () => this.cancelHide());
    this.element.addEventListener("mouseleave", () => this.scheduleHide());
  }

  wire(target: Element, tip: Tip, anchor: Element): void {
    const html = resolver(tip);
    target.addEventListener("mouseenter", () => this.show(html(), anchor));
    target.addEventListener("mouseleave", () => this.scheduleHide());
  }

  /** Wire a hop line so its tooltip pops where the pointer meets the line. A long
      backward hop's endpoints can sit far from where you're hovering, so anchoring
      to a fixed stop drops the tooltip nowhere near the cursor. */
  wireCursor(target: Element, tip: Tip): void {
    const html = resolver(tip);
    target.addEventListener("mouseenter", (event) =>
      this.showAtCursor(html(), event as MouseEvent),
    );
    target.addEventListener("mouseleave", () => this.scheduleHide());
  }

  private showAtCursor(html: string, event: MouseEvent): void {
    this.cursor.style.left = `${event.clientX}px`;
    this.cursor.style.top = `${event.clientY}px`;
    this.show(html, this.cursor);
  }

  private show(html: string, anchor: Element): void {
    this.cancelHide();
    this.element.innerHTML = html;
    this.setAnchor(anchor);

    if (!this.element.matches(":popover-open")) {
      this.element.showPopover();
    }
  }

  private setAnchor(anchor: Element | null): void {
    if (this.anchored === anchor) {
      return;
    }
    styleOf(this.anchored)?.removeProperty("anchor-name");
    this.anchored = anchor;
    styleOf(anchor)?.setProperty("anchor-name", Tooltip.ANCHOR_NAME);
  }

  private scheduleHide(): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.hide(), Tooltip.HIDE_DELAY);
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  hide(): void {
    this.cancelHide();
    this.setAnchor(null);
    if (this.element.matches(":popover-open")) {
      this.element.hidePopover();
    }
  }

  destroy(): void {
    this.hide();
    this.element.remove();
    this.cursor.remove();
  }
}

// Inline style of an element if it has one (HTML/SVG do; bare Element doesn't).
function styleOf(element: Element | null): CSSStyleDeclaration | null {
  return element instanceof HTMLElement || element instanceof SVGElement
    ? element.style
    : null;
}
