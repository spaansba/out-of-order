export type Tip = () => string;

const HIDE_DELAY = 150;

export class Tooltip {
  private readonly anchor: HTMLDivElement;
  private readonly pop: HTMLDivElement;
  private hideTimer: number | undefined;
  private readonly abortController = new AbortController();

  constructor(parent: HTMLElement) {
    this.anchor = document.createElement("div");
    this.anchor.className = "ooo-tip-anchor";
    this.pop = document.createElement("div");
    this.pop.className = "ooo-tip";
    this.pop.popover = "manual";
    parent.append(this.anchor, this.pop);
    const { signal } = this.abortController;
    this.pop.addEventListener("mouseenter", () => clearTimeout(this.hideTimer), { signal });
    this.pop.addEventListener("mouseleave", () => this.hideSoon(), { signal });
  }

  /** atMouse anchors the tip at the pointer instead of the target's centre, for
      long thin targets (hop lines) where the centre can be far from the cursor. */
  public wire(target: Element, tip: Tip, atMouse = false): void {
    const { signal } = this.abortController;
    target.addEventListener(
      "mouseenter",
      (event) => {
        clearTimeout(this.hideTimer);
        let x: number;
        let y: number;
        if (atMouse && event instanceof MouseEvent) {
          x = event.clientX;
          y = event.clientY;
        } else {
          const rect = target.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }
        this.anchor.style.left = `${x}px`;
        this.anchor.style.top = `${y}px`;

        const parsed = new DOMParser().parseFromString(tip(), "text/html");
        this.pop.replaceChildren(...parsed.body.childNodes);
        this.pop.togglePopover(true);
      },
      { signal },
    );

    target.addEventListener("mouseleave", () => this.hideSoon(), { signal });
  }

  private hideSoon(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), HIDE_DELAY);
  }

  public hide(): void {
    clearTimeout(this.hideTimer);
    this.pop.togglePopover(false);
  }

  public destroy(): void {
    this.hide();
    this.abortController.abort();
    this.pop.remove();
    this.anchor.remove();
  }
}
