import { PositionObserver } from "position-observer";

/** What the orchestrator wants to know about; the tracker translates raw browser
    events into these high-level signals. */
export interface TrackerCallbacks {
  /** Observed elements moved (CSS transform, ancestor/layout shift); their fresh
      rects are supplied so only what moved needs re-placing. */
  onMoved(moved: ReadonlyArray<{ target: Element; rect: DOMRectReadOnly }>): void;
  /** A scroll frame: re-place every marker. */
  onScroll(): void;
  /** Viewport resized: re-analyze, since responsive layout can add/remove stops. */
  onResize(): void;
  /** Keyboard focus moved to `element`, or away from any tracked element (null). */
  onFocus(element: Element | null): void;
}

/**
 * Keeps markers glued to their elements. Hybrid by necessity: a frame-synced
 * capture scroll listener handles scrolling (IntersectionObserver, and thus
 * PositionObserver, defers callbacks during active scroll, notably in Safari),
 * while PositionObserver covers movement scrolling can't see (transforms, layout
 * shifts, resizes). Focus is followed with one focusin/out pair on the document.
 */
export class Tracker {
  private readonly positionObserver: PositionObserver;
  private buildRaf = 0;
  private posRaf = 0;

  constructor(private readonly callbacks: TrackerCallbacks) {
    this.positionObserver = new PositionObserver((entries) =>
      callbacks.onMoved(
        entries.map((entry) => ({ target: entry.target, rect: entry.boundingClientRect })),
      ),
    );
  }

  /** Wire the global listeners. Call once, after the first draw. */
  listen(): void {
    window.addEventListener("resize", this.scheduleResize);
    // Capture so nested scroll containers are caught too; passive for smoothness.
    window.addEventListener("scroll", this.scheduleScroll, {
      capture: true,
      passive: true,
    });
    // focusin/out bubble (unlike focus/blur), so one pair on the document follows
    // focus across every tab stop.
    document.addEventListener("focusin", this.onFocusIn);
    document.addEventListener("focusout", this.onFocusOut);
  }

  /** Point the position observer at a fresh element set (after a rebuild). */
  observe(elements: Element[]): void {
    this.positionObserver.disconnect();
    for (const element of elements) {
      this.positionObserver.observe(element);
    }
  }

  destroy(): void {
    if (this.buildRaf) {
      cancelAnimationFrame(this.buildRaf);
    }
    if (this.posRaf) {
      cancelAnimationFrame(this.posRaf);
    }
    this.positionObserver.disconnect();
    window.removeEventListener("resize", this.scheduleResize);
    window.removeEventListener("scroll", this.scheduleScroll, true);
    document.removeEventListener("focusin", this.onFocusIn);
    document.removeEventListener("focusout", this.onFocusOut);
  }

  private readonly scheduleResize = (): void => {
    if (this.buildRaf) {
      return;
    }
    this.buildRaf = requestAnimationFrame(() => {
      this.buildRaf = 0;
      this.callbacks.onResize();
    });
  };

  private readonly scheduleScroll = (): void => {
    if (this.posRaf) {
      return;
    }
    this.posRaf = requestAnimationFrame(() => {
      this.posRaf = 0;
      this.callbacks.onScroll();
    });
  };

  private readonly onFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    this.callbacks.onFocus(target instanceof Element ? target : null);
  };

  private readonly onFocusOut = (): void => {
    this.callbacks.onFocus(null);
  };
}
