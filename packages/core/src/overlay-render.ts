import {
  ensureRingStyles,
  RING_CLASS,
  RING_BAD_CLASS,
  RING_WARN_CLASS,
} from "./overlay-styles.js";
import type { Severity } from "./types.js";
import type { Tooltip, Tip } from "./overlay-tooltip.js";

/** All three ring states, so a rebuild/destroy can strip whichever one is set. */
const RING_CLASSES = [RING_CLASS, RING_WARN_CLASS, RING_BAD_CLASS];

const SVG_NS = "http://www.w3.org/2000/svg" as const;
/** Badge radius, and how far to pull a segment back from each badge so the line
    stops just outside the circles (the arrowhead now sits at the midpoint). */
const RADIUS = 11;
const SEG_PAD = RADIUS + 5;

/** Create an SVG element with attributes and children in one call, dropping the
    repetitive createElementNS + setAttribute boilerplate. */
function svgEl<Tag extends keyof SVGElementTagNameMap>(
  tag: Tag,
  attrs: Record<string, string | number> = {},
  ...kids: Node[]
): SVGElementTagNameMap[Tag] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const attrName in attrs) {
    node.setAttribute(attrName, String(attrs[attrName]));
  }
  node.append(...kids);
  return node;
}

/** One numbered (or ⊘) badge to draw over an element. */
export interface StopSpec {
  element: Element;
  /** Badge label: the 1-based position, or "⊘" for an off-sequence marker. */
  label: string;
  /** Worst severity among the element's findings, driving badge + ring colour
      (amber warning / red error), or null when the element is clean (green). */
  severity: Severity | null;
  /** A real tab stop (numbered) vs. an interactive-but-unreachable control (⊘). */
  inSeq: boolean;
  /** Carries the `autofocus` attribute → gets an informational marker (not a
      violation): this is where focus lands on load. */
  autofocus: boolean;
  /** Tooltip shown on hover (built lazily — see Tip). */
  tip: Tip;
}

/** One hop between consecutive numbered stops. */
export interface SegSpec {
  /** Runs against the reading order (fixed at analyze time, see Segment.back). */
  back: boolean;
  /** Tooltip shown on hover (built lazily — see Tip). */
  tip: Tip;
}

interface Marker {
  element: Element;
  group: SVGGElement;
  circle: SVGCircleElement;
  text: SVGTextElement;
  /** Autofocus indicator pinned to the badge corner, or null when the element
      has no `autofocus`. Repositioned alongside the badge as it moves. */
  af: SVGGElement | null;
  /** Cached center, so the connecting segments can update from what moved. */
  centerX: number;
  centerY: number;
}

interface Segment {
  from: Marker;
  toMarker: Marker;
  /** Visible connector: a 3-point polyline (start → mid → end) so a marker-mid
      arrowhead lands in the middle of the hop. */
  line: SVGPolylineElement;
  hit: SVGLineElement;
  /** Whether this hop runs against the reading order. Fixed here (not recomputed
      from live geometry) so the line's colour stays locked to the element's ring
      and doesn't flicker when a sticky element scrolls. */
  back: boolean;
}

/**
 * Owns the SVG layer: badges, connecting arrows, and the per-element rings.
 * Geometry only: it knows nothing about the analyzer; the orchestrator hands it
 * a draw model (StopSpec/SegSpec) and tells it when to re-place markers.
 */
export class Renderer {
  private svg: SVGSVGElement | null = null;
  private markers: Marker[] = [];
  private segments: Segment[] = [];
  private readonly byEl = new Map<Element, Marker>();
  // Elements we've ringed, kept so we can untag them on rebuild/destroy.
  private ringEls: Element[] = [];
  // The badge of the currently keyboard-focused element, filled in as a cursor.
  private focused: Marker | null = null;

  constructor(
    private readonly layer: HTMLElement,
    private readonly tooltip: Tooltip,
  ) {}

  /** Replace the drawing: numbered stops (in order), the hops between them, then
      any off-sequence stops. Badges paint on top of the lines. */
  draw(stops: StopSpec[], segs: SegSpec[], offStops: StopSpec[]): void {
    this.clear();
    const svg = svgEl("svg", { class: "fp-svg" }, buildDefs());
    // Segments live in their own group, appended first so badges paint over them.
    const segLayer = svgEl("g");
    svg.appendChild(segLayer);
    this.svg = svg;

    stops.forEach((stop) => this.addMarker(stop));

    for (let idx = 0; idx < this.markers.length - 1; idx++) {
      const from = this.markers[idx]!;
      const toMarker = this.markers[idx + 1]!;
      const { back, tip } = segs[idx]!;
      // Forward (green) hops are correct: click-through, no tooltip. Only backward
      // (red) hops carry the fat hit-line and a hover tooltip.
      const hit = svgEl("line", {
        class: back ? "fp-hit fp-hit--back" : "fp-hit",
      });
      const line = svgEl("polyline", { class: "fp-seg" });
      segLayer.append(hit, line);
      this.segments.push({ from, toMarker, line, hit, back });
      if (back) {
        // Pop the tooltip where the pointer meets the line: a long backward hop's
        // endpoints can sit far from where you're actually hovering.
        this.tooltip.wireCursor(hit, tip);
      }
    }

    offStops.forEach((stop) => this.addMarker(stop));
    this.layer.appendChild(svg);
  }

  /** One getBoundingClientRect pass to set geometry (initial + scroll frames).
      All rect reads run before any SVG writes, so a scroll frame triggers a
      single layout flush instead of one reflow per marker (read→write→read…). */
  seed(): void {
    const rects = this.markers.map((marker) =>
      marker.element.getBoundingClientRect(),
    );
    this.syncSize();
    this.markers.forEach((marker, idx) => this.applyRect(marker, rects[idx]!));
    this.updateSegments();
  }

  /** Apply fresh rects for the elements the position observer saw move, then
      refresh the connecting segments. */
  applyMoved(
    moved: ReadonlyArray<{ target: Element; rect: DOMRectReadOnly }>,
  ): void {
    this.syncSize();
    for (const { target, rect } of moved) {
      const marker = this.byEl.get(target);
      if (!marker) {
        continue;
      }
      this.applyRect(marker, rect);
    }
    this.updateSegments();
  }

  /** Fill the badge of `el` (or none) as a live "you are here" cursor. */
  setFocused(element: Element | null): void {
    const marker = element ? (this.byEl.get(element) ?? null) : null;
    if (this.focused === marker) {
      return;
    }
    this.focused?.group.classList.remove("fp-badge--on");
    this.focused = marker;
    this.focused?.group.classList.add("fp-badge--on");
  }

  /** Every element with a badge, for the tracker to observe. */
  elementsToObserve(): Element[] {
    return this.markers.map((marker) => marker.element);
  }

  /** Tear down the current drawing (SVG + rings); leaves the renderer reusable. */
  clear(): void {
    this.svg?.remove();
    this.svg = null;
    this.markers = [];
    this.segments = [];
    this.byEl.clear();
    this.focused = null;
    for (const element of this.ringEls) {
      element.classList.remove(...RING_CLASSES);
    }
    this.ringEls = [];
  }

  /** Create a badge group (circle + label) for an element and ring the element. */
  private addMarker(spec: StopSpec): void {
    this.markRing(spec.element, spec.severity);

    let cls = "fp-badge";
    if (spec.severity) {
      cls += spec.severity === "error" ? " fp-badge--bad" : " fp-badge--warn";
    }
    if (!spec.inSeq) {
      cls += " fp-badge--off";
    }

    const circle = svgEl("circle", { r: RADIUS });
    const text = svgEl("text", { "text-anchor": "middle" });
    text.textContent = spec.label;
    const group = svgEl("g", { class: cls }, circle, text);
    // Small "focus lands here" badge in the corner: a disc with a downward arrow.
    // Informational (blue), not a violation, and translated into place each frame.
    const af = spec.autofocus
      ? svgEl(
          "g",
          { class: "fp-af" },
          svgEl("circle", { r: 7 }),
          svgEl("path", { d: "M-3,-2 L3,-2 L0,2.5 Z" }),
        )
      : null;
    if (af) {
      group.appendChild(af);
    }
    this.svg!.appendChild(group);

    const marker: Marker = {
      element: spec.element,
      group,
      circle,
      text,
      af,
      centerX: 0,
      centerY: 0,
    };
    this.markers.push(marker);
    this.byEl.set(spec.element, marker);
    // Every badge is hoverable: the tooltip shows the stop's name/role and either
    // its findings or a clean "no issues" confirmation.
    this.tooltip.wire(group, spec.tip, spec.element);
  }

  /** Tag a real element so CSS rings it (until it's keyboard-focused): green when
      clean, amber on a warning, red on an error. */
  private markRing(element: Element, severity: Severity | null): void {
    const ringClass =
      severity === "error"
        ? RING_BAD_CLASS
        : severity === "warning"
          ? RING_WARN_CLASS
          : RING_CLASS;
    element.classList.add(ringClass);
    this.ringEls.push(element);
    // Elements inside a shadow root need the rule mirrored in; document styles
    // don't cross the boundary.
    const root = element.getRootNode();
    if (root instanceof ShadowRoot) {
      ensureRingStyles(root);
    }
  }

  private applyRect(marker: Marker, rect: DOMRectReadOnly): void {
    marker.centerX = rect.left + rect.width / 2;
    marker.centerY = rect.top + rect.height / 2;
    // Center the badge on the element; segments stop just outside it via SEG_PAD.
    marker.circle.setAttribute("cx", String(marker.centerX));
    marker.circle.setAttribute("cy", String(marker.centerY));
    marker.text.setAttribute("x", String(marker.centerX));
    marker.text.setAttribute("y", String(marker.centerY + 4));
    // Pin the autofocus badge to the stop's top-right corner.
    marker.af?.setAttribute(
      "transform",
      `translate(${marker.centerX + RADIUS}, ${marker.centerY - RADIUS})`,
    );
  }

  /** Redraw every hop: shorten it to the badge edges and drop the arrow at the
      midpoint. Colour (green forward / red backward) is fixed at analyze time
      (see Segment.back) and not recomputed here, so it can't drift from the ring. */
  private updateSegments(): void {
    for (const seg of this.segments) {
      const deltaX = seg.toMarker.centerX - seg.from.centerX;
      const deltaY = seg.toMarker.centerY - seg.from.centerY;
      const len = Math.hypot(deltaX, deltaY) || 1;
      const unitX = deltaX / len;
      const unitY = deltaY / len;

      let startX = seg.from.centerX;
      let startY = seg.from.centerY;
      let endX = seg.toMarker.centerX;
      let endY = seg.toMarker.centerY;
      if (len > 2 * SEG_PAD + 6) {
        startX = seg.from.centerX + unitX * SEG_PAD;
        startY = seg.from.centerY + unitY * SEG_PAD;
        endX = seg.toMarker.centerX - unitX * SEG_PAD;
        endY = seg.toMarker.centerY - unitY * SEG_PAD;
      }
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;

      seg.hit.setAttribute("x1", String(startX));
      seg.hit.setAttribute("y1", String(startY));
      seg.hit.setAttribute("x2", String(endX));
      seg.hit.setAttribute("y2", String(endY));
      // A midpoint vertex carries the marker-mid arrowhead, oriented along the hop.
      seg.line.setAttribute(
        "points",
        `${startX},${startY} ${midX},${midY} ${endX},${endY}`,
      );
      seg.line.setAttribute(
        "class",
        seg.back ? "fp-seg fp-seg--back" : "fp-seg",
      );
      seg.line.setAttribute(
        "marker-mid",
        seg.back ? "url(#fp-arrow-back)" : "url(#fp-arrow)",
      );
    }
  }

  private syncSize(): void {
    if (!this.svg) {
      return;
    }
    this.svg.setAttribute(
      "width",
      String(document.documentElement.clientWidth),
    );
    this.svg.setAttribute(
      "height",
      String(document.documentElement.clientHeight),
    );
  }
}

/** Two arrowheads (forward green, backward red) dropped at each hop's midpoint
    via marker-mid. refX centers the glyph on the midpoint vertex. */
function buildDefs(): SVGDefsElement {
  const defs = svgEl("defs");
  for (const [markerId, fill] of [
    ["fp-arrow", "#2f6a47"],
    ["fp-arrow-back", "#b3261e"],
  ] as const) {
    // A slim notched chevron: enough to read direction without weighing the line.
    const path = svgEl("path", { d: "M3,2.5 L14,8 L3,13.5 L6.5,8 Z", fill });
    const marker = svgEl(
      "marker",
      {
        id: markerId,
        markerWidth: 16,
        markerHeight: 16,
        refX: 8,
        refY: 8,
        orient: "auto",
        markerUnits: "userSpaceOnUse",
      },
      path,
    );
    defs.appendChild(marker);
  }
  return defs;
}
