/** Tooltip content, built on first hover so a redraw doesn't pay for HTML the
    pointer never opens. */
export type Tip = () => string;

/** Resolve a Tip once and memoize. */
function resolver(tip: Tip): () => string {
  let html: string | null = null;
  return () => (html ??= tip());
}

export class Tooltip {
  private readonly element: HTMLDivElement;
  private readonly cursor: HTMLDivElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  // Grace period for the cursor to travel from the target into the tooltip.
  private static readonly HIDE_DELAY = 150;

  constructor(parent: HTMLElement) {
    this.cursor = document.createElement("div");
    this.cursor.className = "ooo-tip-cursor";
    parent.appendChild(this.cursor);

    this.element = document.createElement("div");
    this.element.className = "ooo-tip";
    this.element.setAttribute("popover", "manual");
    parent.appendChild(this.element);

    // Wired once (not per target) so they don't accumulate. Hovering the tooltip
    // keeps it open for selecting/copying; leaving it schedules the hide.
    this.element.addEventListener("mouseenter", () => this.cancelHide());
    this.element.addEventListener("mouseleave", () => this.scheduleHide());
  }

  /** Wire a hover target (badge or hop line) so its tooltip pops where the pointer
      meets it. Badges sit right under the pointer and a long backward hop's
      endpoints can sit far from where you hover, so the pointer suits both. */
  wire(target: Element, tip: Tip): void {
    const html = resolver(tip);
    target.addEventListener("mouseenter", (event) =>
      this.show(html(), event as MouseEvent),
    );
    target.addEventListener("mouseleave", () => this.scheduleHide());
  }

  private show(html: string, event: MouseEvent): void {
    this.cancelHide();
    this.cursor.style.left = `${event.clientX}px`;
    this.cursor.style.top = `${event.clientY}px`;
    this.element.innerHTML = html;
    if (!this.element.matches(":popover-open")) {
      this.element.showPopover();
    }
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
