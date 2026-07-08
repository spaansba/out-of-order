import { ensureRingStyles } from "./styles.js";
import { needsManualPlacement } from "./util.js";
import { AnchorRegistry } from "./anchor-registry.js";
import { GeometryPlacer } from "./geometry-placer.js";
import type { Severity } from "@out-of-order/core";
import type { Tooltip } from "./tooltip.js";
import type { StopSpec, SegmentSpec } from "./specs.js";

export type { StopSpec, SegmentSpec };

// An attribute on page elements, not a class, so the analyzer's selectors never
// see the overlay's own markup.
const RING_ATTR = "data-ooo-ring";

export class Renderer {
  private drawLayer: HTMLElement | null = null;
  private readonly byEl = new Map<Element, HTMLElement>();
  private ringEls: { element: Element; value: string }[] = [];
  private ringsVisible = true;
  private focused: HTMLElement | null = null;
  private readonly anchors = new AnchorRegistry();
  private readonly geometry = new GeometryPlacer();

  constructor(
    private readonly layer: HTMLElement,
    private readonly tooltip: Tooltip,
  ) {}

  public draw(stops: StopSpec[], segments: SegmentSpec[], offStops: StopSpec[]): void {
    this.clear();
    this.drawLayer = document.createElement("div");
    this.drawLayer.className = "ooo-draw";

    const all = [...stops, ...offStops];

    const names = this.anchors.resolveAnchorNames(all);
    for (const stop of all) {
      this.markRing(stop.element, stop.severity);
    }
    this.anchors.publishAnchors(all, names);

    this.drawHops(stops, segments, names, this.drawLayer);
    for (const stop of all) {
      this.addBadge(stop, names.get(stop.element)!, this.drawLayer);
    }

    this.layer.appendChild(this.drawLayer);
    this.geometry.placeManual();
  }

  public get hasLiveGeometry(): boolean {
    return this.geometry.hasLiveGeometry;
  }

  public placeManual(): void {
    this.geometry.placeManual();
  }

  /** A hop between a floating and an in-flow stop spans two scroll regimes,
      which anchors can't express: only the default anchor gets scroll
      adjustment, and it moves the box as a whole. Those hops are JS-placed (via
      placeManual); same-regime hops ride the CSS anchors published above. */
  private drawHops(
    stops: StopSpec[],
    segments: SegmentSpec[],
    names: Map<Element, string>,
    draw: HTMLElement,
  ): void {
    for (let idx = 0; idx < stops.length - 1; idx++) {
      const from = stops[idx]!;
      const to = stops[idx + 1]!;
      // A seam hop (JS-placed from live geometry) also covers any endpoint that
      // can't be a CSS anchor, since the CSS quadrant candidates need both.
      if (
        from.floats !== to.floats ||
        needsManualPlacement(from.element) ||
        needsManualPlacement(to.element)
      ) {
        this.addMixedHop(from.element, to.element, segments[idx]!, draw);
        continue;
      }
      const hop = this.addHop(
        from.floats,
        names.get(from.element)!,
        names.get(to.element)!,
        segments[idx]!,
        draw,
      );
      this.geometry.trackNamedHop(hop, from.element, to.element);
    }
  }

  private addMixedHop(from: Element, to: Element, segment: SegmentSpec, parent: HTMLElement): void {
    const hop = document.createElement("div");
    const line = document.createElement("div");
    line.className = "ooo-hop-line";
    hop.appendChild(line);
    if (segment.back) {
      this.tooltip.wire(line, segment.tip, true);
    }
    parent.appendChild(hop);
    this.geometry.trackMixedHop(hop, from, to, segment.back);
  }

  public setFocused(element: Element | null): void {
    const badge = element ? (this.byEl.get(element) ?? null) : null;
    if (this.focused === badge) {
      return;
    }
    this.focused?.classList.remove("ooo-badge--on");
    this.focused = badge;
    this.focused?.classList.add("ooo-badge--on");
  }

  // Rings sit on the page, not in the hideable layer, so hiding the layer
  // alone would leave them behind.
  public setRingsVisible(visible: boolean): void {
    if (this.ringsVisible === visible) {
      return;
    }
    this.ringsVisible = visible;
    for (const { element, value } of this.ringEls) {
      if (visible) {
        element.setAttribute(RING_ATTR, value);
      } else {
        element.removeAttribute(RING_ATTR);
      }
    }
  }

  public clear(): void {
    this.drawLayer?.remove();
    this.drawLayer = null;
    this.byEl.clear();
    this.geometry.clear();
    this.focused = null;
    this.anchors.clear();
    for (const { element } of this.ringEls) {
      element.removeAttribute(RING_ATTR);
    }
    this.ringEls = [];
  }

  /** clear() plus giving the document its stylesheet slot back; the renderer
      is unusable afterwards. */
  public dispose(): void {
    this.clear();
    this.anchors.dispose();
  }

  private addBadge(spec: StopSpec, anchorName: string, parent: HTMLElement): void {
    let cls = "ooo-badge";
    if (spec.severity) {
      cls += spec.severity === "error" ? " ooo-badge--bad" : " ooo-badge--warn";
    }
    if (!spec.inSeq) {
      cls += " ooo-badge--off";
    }
    if (spec.floats) {
      cls += " ooo-fix";
    }
    const badge = document.createElement("div");
    badge.className = cls;
    if (needsManualPlacement(spec.element)) {
      this.geometry.trackManualBadge(badge, spec.element, spec.floats);
    } else {
      badge.style.setProperty("--ooo-anchor", anchorName);
    }
    badge.textContent = spec.label;
    if (spec.autofocus) {
      const af = document.createElement("div");
      af.className = "ooo-af";
      badge.appendChild(af);
    }
    parent.appendChild(badge);
    this.byEl.set(spec.element, badge);
    this.tooltip.wire(badge, spec.tip);
  }

  private addHop(
    fixed: boolean,
    fromName: string,
    toName: string,
    segment: SegmentSpec,
    parent: HTMLElement,
  ): HTMLElement {
    const hop = document.createElement("div");

    hop.className = `ooo-hop${segment.back ? " ooo-hop--back" : ""}${fixed ? " ooo-fix" : ""}`;
    hop.style.setProperty("--ooo-from", fromName);
    hop.style.setProperty("--ooo-to", toName);
    const line = document.createElement("div");
    line.className = "ooo-hop-line";
    hop.appendChild(line);
    // Only backward (red) hops are hoverable; forward hops stay click-through.
    if (segment.back) {
      this.tooltip.wire(line, segment.tip, true);
    }
    parent.appendChild(hop);
    return hop;
  }

  private markRing(element: Element, severity: Severity | null): void {
    const value = severity === "error" ? "bad" : severity === "warning" ? "warn" : "ok";
    // Keep the attribute off while hidden so a rebuild mid-hide doesn't repaint the ring.
    if (this.ringsVisible) {
      element.setAttribute(RING_ATTR, value);
    }
    this.ringEls.push({ element, value });
    // Elements inside a shadow root need the rule mirrored in; document styles
    // don't cross the boundary.
    const root = element.getRootNode();
    if (root instanceof ShadowRoot) {
      ensureRingStyles(root);
    }
  }
}
