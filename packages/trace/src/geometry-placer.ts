type HopVariant = "se" | "ne" | "sw" | "nw";

const HOP_VARIANT_CLASSES = ["ooo-hop--se", "ooo-hop--ne", "ooo-hop--sw", "ooo-hop--nw"];

interface MixedHop {
  hop: HTMLElement;
  from: Element;
  to: Element;
  back: boolean;
}

interface NamedHop {
  hop: HTMLElement;
  from: Element;
  to: Element;
}

interface ManualBadge {
  badge: HTMLElement;
  element: Element;
  floats: boolean;
}

/** Owns every box facet that lives geometry (not CSS anchors) has to drive:
    JS-placed seam hops and non-anchorable badges, plus the quadrant class an
    anchored hop bakes from the sign of its two endpoints. */
export class GeometryPlacer {
  private mixed: MixedHop[] = [];
  private namedHops: NamedHop[] = [];
  private manuallyPlacedBadges: ManualBadge[] = [];

  /** Whether any box depends on live geometry: JS-placed seam hops and badges,
      or anchored hops whose baked quadrant class a reflow can invalidate. Lets
      the scroll/resize listeners bail on pages with nothing to re-derive. */
  public get hasLiveGeometry(): boolean {
    return (
      this.mixed.length > 0 || this.manuallyPlacedBadges.length > 0 || this.namedHops.length > 0
    );
  }

  public trackMixedHop(hop: HTMLElement, from: Element, to: Element, back: boolean): void {
    this.mixed.push({ hop, from, to, back });
  }

  public trackNamedHop(hop: HTMLElement, from: Element, to: Element): void {
    this.namedHops.push({ hop, from, to });
  }

  public trackManualBadge(badge: HTMLElement, element: Element, floats: boolean): void {
    this.manuallyPlacedBadges.push({ badge, element, floats });
  }

  public clear(): void {
    this.mixed = [];
    this.namedHops = [];
    this.manuallyPlacedBadges = [];
  }

  /** Re-derive every box facet that JS owns from live geometry: seam hop and
      non-anchorable badge positions, plus anchored hops' quadrant classes. */
  public placeManual(): void {
    // All rect reads before any writes: one layout flush for the whole pass.
    const rects = this.mixed.map(({ from, to }) => [
      from.getBoundingClientRect(),
      to.getBoundingClientRect(),
    ]);

    const badgeRects = this.manuallyPlacedBadges.map(({ element }) =>
      element.getBoundingClientRect(),
    );

    const variants = this.namedHops.map(({ from, to }) => centerQuadrant(from, to));

    this.mixed.forEach(({ hop, back }, idx) => {
      const [a, b] = rects[idx]!;
      const ax = a!.left + a!.width / 2;
      const ay = a!.top + a!.height / 2;
      const bx = b!.left + b!.width / 2;
      const by = b!.top + b!.height / 2;
      // Same box + variant an anchored hop picks, so the line styles apply unchanged.
      const variant = quadrant(ax, ay, bx, by);
      hop.className = `ooo-hop ooo-hop--seam ooo-hop--${variant}${back ? " ooo-hop--back" : ""} ooo-fix`;
      hop.style.left = `${Math.min(ax, bx) - 0.5}px`;
      hop.style.top = `${Math.min(ay, by) - 0.5}px`;
      hop.style.width = `${Math.abs(bx - ax) + 1}px`;
      hop.style.height = `${Math.abs(by - ay) + 1}px`;
    });

    this.manuallyPlacedBadges.forEach(({ badge, floats }, idx) => {
      const rect = badgeRects[idx]!;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      badge.style.left = `${floats ? cx : cx + window.scrollX}px`;
      badge.style.top = `${floats ? cy : cy + window.scrollY}px`;
    });

    // A reflow can flip a hop's quadrant, and the box insets key on the baked
    // variant class (a stale one computes a negative size and collapses to
    // nothing), so restamp it. Touch the DOM only on change: this runs per
    // frame during a resize drag.
    this.namedHops.forEach(({ hop }, idx) => {
      const next = `ooo-hop--${variants[idx]}`;
      if (!hop.classList.contains(next)) {
        hop.classList.remove(...HOP_VARIANT_CLASSES);
        hop.classList.add(next);
      }
    });
  }
}

// Which quadrant B sits in relative to A, picking the matching hop box + line
// orientation. Pure CSS can't recover this sign from the two anchors, so it's
// read from live geometry (scroll-invariant, so a redraw only owes it to reflow).
function centerQuadrant(from: Element, to: Element): HopVariant {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  return quadrant(
    a.left + a.width / 2,
    a.top + a.height / 2,
    b.left + b.width / 2,
    b.top + b.height / 2,
  );
}

function quadrant(ax: number, ay: number, bx: number, by: number): HopVariant {
  return `${by >= ay ? "s" : "n"}${bx >= ax ? "e" : "w"}` as HopVariant;
}
