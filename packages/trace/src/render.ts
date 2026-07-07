import {
  createAnchorSheet,
  ensureRingStyles,
  releaseAnchorSheet,
  setAnchorRules,
} from "./styles.js";
import type { Severity } from "@out-of-order/core";
import type { Tooltip, Tip } from "./tooltip.js";

// Attributes on page elements, not classes, so the analyzer's selectors never
// see the overlay's own markup.
const RING_ATTR = "data-ooo-ring";
const ANCHOR_ATTR = "data-ooo-anchor";

export interface StopSpec {
  element: Element;
  label: string;
  severity: Severity | null;
  inSeq: boolean;
  autofocus: boolean;
  /** Rides a fixed/sticky ancestor: anchor scroll compensation misses those, so
      its badge/hops are position:fixed instead of document-space. */
  floats: boolean;
  tip: Tip;
}

export interface SegmentSpec {
  back: boolean;
  tip: Tip;
}

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

export class Renderer {
  private drawLayer: HTMLElement | null = null;
  private readonly byEl = new Map<Element, HTMLElement>();
  private anchored: { element: Element; exported: Element[] }[] = [];
  private mixed: MixedHop[] = [];
  private namedHops: NamedHop[] = [];
  private manuallyPlacedBadges: ManualBadge[] = [];
  private ringEls: { element: Element; value: string }[] = [];
  private ringsVisible = true;
  private focused: HTMLElement | null = null;
  private readonly anchorSheet = createAnchorSheet();
  private readonly token = nextInstanceToken();

  constructor(
    private readonly layer: HTMLElement,
    private readonly tooltip: Tooltip,
  ) {}

  public draw(stops: StopSpec[], segments: SegmentSpec[], offStops: StopSpec[]): void {
    this.clear();
    this.drawLayer = document.createElement("div");
    this.drawLayer.className = "ooo-draw";

    const all = [...stops, ...offStops];

    const names = this.resolveAnchorNames(all);
    for (const stop of all) {
      this.markRing(stop.element, stop.severity);
    }
    this.publishAnchors(all, names);

    this.drawHops(stops, segments, names, this.drawLayer);
    for (const stop of all) {
      this.addBadge(stop, names.get(stop.element)!, this.drawLayer);
    }

    this.layer.appendChild(this.drawLayer);
    this.placeManual();
  }

  /** Reuse an anchor name if element already has one there, else use our own */
  private resolveAnchorNames(stops: StopSpec[]): Map<Element, string> {
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
  private publishAnchors(stops: StopSpec[], names: Map<Element, string>): void {
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
      // The .ooo-draw layer is still detached here, so reading endpoint geometry
      // to pick the quadrant doesn't thrash layout against the DOM we append.
      const variant = centerQuadrant(from.element, to.element);
      const hop = this.addHop(
        from.floats,
        names.get(from.element)!,
        names.get(to.element)!,
        variant,
        segments[idx]!,
        draw,
      );
      this.namedHops.push({ hop, from: from.element, to: to.element });
    }
  }

  /** Whether any box depends on live geometry: JS-placed seam hops and badges,
      or anchored hops whose baked quadrant class a reflow can invalidate. Lets
      the scroll/resize listeners bail on pages with nothing to re-derive. */
  public get hasLiveGeometry(): boolean {
    return (
      this.mixed.length > 0 || this.manuallyPlacedBadges.length > 0 || this.namedHops.length > 0
    );
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

  private addMixedHop(from: Element, to: Element, segment: SegmentSpec, parent: HTMLElement): void {
    const hop = document.createElement("div");
    const line = document.createElement("div");
    line.className = "ooo-hop-line";
    hop.appendChild(line);
    if (segment.back) {
      this.tooltip.wire(line, segment.tip, true);
    }
    parent.appendChild(hop);
    this.mixed.push({ hop, from, to, back: segment.back });
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
    this.mixed = [];
    this.namedHops = [];
    this.manuallyPlacedBadges = [];
    this.focused = null;
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
    for (const { element } of this.ringEls) {
      element.removeAttribute(RING_ATTR);
    }
    this.ringEls = [];
  }

  /** clear() plus giving the document its stylesheet slot back; the renderer
      is unusable afterwards. */
  public dispose(): void {
    this.clear();
    releaseAnchorSheet(this.anchorSheet);
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
      this.manuallyPlacedBadges.push({ badge, element: spec.element, floats: spec.floats });
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
    variant: HopVariant,
    segment: SegmentSpec,
    parent: HTMLElement,
  ): HTMLElement {
    const hop = document.createElement("div");
    hop.className =
      `ooo-hop ooo-hop--${variant}` +
      `${segment.back ? " ooo-hop--back" : ""}${fixed ? " ooo-fix" : ""}`;
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

function nextInstanceToken(): number {
  const shared = globalThis as { __oooAnchorToken?: number };
  shared.__oooAnchorToken = (shared.__oooAnchorToken ?? 0) + 1;
  return shared.__oooAnchorToken;
}

// CSS anchor-name only takes effect on elements that generate a principal CSS
// box. SVG layout elements (and other non-HTML content) don't, so anchoring a
// badge to one silently no-ops; those badges and any hop touching them are
// placed from live geometry instead.
function needsManualPlacement(element: Element): boolean {
  return !(element instanceof HTMLElement);
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
