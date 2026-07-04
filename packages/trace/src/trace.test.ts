import { afterEach, describe, expect, test, vi } from "vitest";
import { flaggedEntries } from "@out-of-order/core";
import { trace, type TraceHandle, type TraceOptions } from "./index.js";

let handle: TraceHandle | null = null;
let root: HTMLElement;

/** Mount a fresh, scoped overlay over `html`. */
function mount(html: string, options: Omit<TraceOptions, "root"> = {}): TraceHandle {
  root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  handle = trace({ root, ...options });
  return handle;
}

const layer = (): HTMLElement => document.querySelector(".ooo-layer")!;
const numbered = (): NodeListOf<Element> =>
  layer().querySelectorAll(".ooo-badge:not(.ooo-badge--off)");

afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.innerHTML = "";
  window.scrollTo(0, 0);
  // Panel state persists in localStorage; clear it so tests don't leak into each other.
  localStorage.clear();
});

describe("trace", () => {
  test("appends an overlay layer", () => {
    mount("<button>A</button>");
    expect(layer()).not.toBeNull();
  });

  test("draws one numbered badge per tab stop", () => {
    mount('<button>A</button><a href="#">B</a><input aria-label="C">');
    expect(numbered()).toHaveLength(3);
    expect(handle!.result!.sequence).toHaveLength(3);
  });

  test("rings and badges a violating stop in red", () => {
    mount('<button>Fine</button><button tabindex="2">Jumped</button>');
    expect(layer().querySelector(".ooo-badge--bad")).not.toBeNull();
    expect(root.querySelector('[tabindex="2"]')!.getAttribute("data-ooo-ring")).toBe("bad");
  });

  test("marks an interactive-but-unreachable control with an off-sequence glyph", () => {
    mount('<div role="button" onclick="x()">Ghost</div>');
    const off = layer().querySelector(".ooo-badge--off");
    expect(off).not.toBeNull();
    expect(off!.textContent).toBe("⊘");
    expect(numbered()).toHaveLength(0);
  });

  test("setVisible hides the drawing but keeps the panel", () => {
    mount("<button>A</button>");
    handle!.setVisible(false);
    expect(layer().classList.contains("ooo-hidden")).toBe(true);
    // The control panel shares the layer and stays put, so "Show overlay" is reachable.
    expect(layer().querySelector(".ooo-panel")).not.toBeNull();
    handle!.setVisible(true);
    expect(layer().classList.contains("ooo-hidden")).toBe(false);
  });

  test("the overlay switch toggles visibility and tracks state", () => {
    mount("<button>A</button>");
    const vis = layer().querySelector(".ooo-switch--vis") as HTMLButtonElement;
    // Starts on (overlay shown).
    expect(vis.getAttribute("aria-checked")).toBe("true");
    expect(vis.classList.contains("ooo-switch--on")).toBe(true);
    vis.click();
    expect(handle!.visible).toBe(false);
    expect(layer().classList.contains("ooo-hidden")).toBe(true);
    expect(vis.getAttribute("aria-checked")).toBe("false");
    expect(vis.classList.contains("ooo-switch--on")).toBe(false);
    vis.click();
    expect(handle!.visible).toBe(true);
    expect(vis.getAttribute("aria-checked")).toBe("true");
  });

  const tapAlt = (): void => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", altKey: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", altKey: false }));
  };

  test("tapping the peek modifier toggles click-through, then back", () => {
    mount("<button>A</button>");
    // Default peek key is Alt: a lone tap turns the overlay click-through.
    tapAlt();
    expect(layer().dataset.oooPeek).toBe("on");
    tapAlt();
    expect(layer().dataset.oooPeek).toBe("off");
  });

  test("the peek switch toggles click-through on click", () => {
    mount("<button>A</button>");
    const peek = layer().querySelector(".ooo-switch--peek") as HTMLButtonElement;
    expect(peek).not.toBeNull();
    expect(peek.getAttribute("aria-checked")).toBe("false");
    peek.click();
    expect(layer().dataset.oooPeek).toBe("on");
    expect(peek.getAttribute("aria-checked")).toBe("true");
    expect(peek.classList.contains("ooo-switch--on")).toBe(true);
    peek.click();
    expect(layer().dataset.oooPeek).toBe("off");
  });

  test("hiding the overlay disables the peek switch", () => {
    mount("<button>A</button>");
    const peek = layer().querySelector(".ooo-switch--peek") as HTMLButtonElement;
    expect(peek.disabled).toBe(false);
    handle!.setVisible(false);
    // Click-through is meaningless with nothing drawn, so it's disabled while hidden.
    expect(peek.disabled).toBe(true);
    // And the modifier tap is a no-op while hidden.
    tapAlt();
    expect(layer().dataset.oooPeek).toBe("off");
    handle!.setVisible(true);
    expect(peek.disabled).toBe(false);
  });

  test("controls: false skips the panel but keeps the overlay and peek key", () => {
    mount("<button>A</button>", { controls: false });
    expect(layer().querySelector(".ooo-panel")).toBeNull();
    expect(numbered()).toHaveLength(1);
    tapAlt();
    expect(layer().dataset.oooPeek).toBe("on");
    tapAlt();
    expect(layer().dataset.oooPeek).toBe("off");
  });

  test("the title collapses and expands the panel", () => {
    mount("<button>A</button>");
    const panel = layer().querySelector(".ooo-panel") as HTMLElement;
    const title = panel.querySelector(".ooo-panel-title") as HTMLButtonElement;
    // Starts open with the switches visible.
    expect(panel.dataset.open).toBe("1");
    title.click();
    expect(panel.dataset.open).toBe("0");
    title.click();
    expect(panel.dataset.open).toBe("1");
  });

  test("a modifier combo (not a lone tap) doesn't toggle peek", () => {
    mount("<button>A</button>");
    // Alt+Tab style: another key joins the press, so it isn't a peek tap.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", altKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", altKey: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", altKey: false }));
    expect(layer().dataset.oooPeek).toBe("off");
  });

  test("a click between press and release doesn't toggle peek", () => {
    mount("<button>A</button>");
    // Hold-and-click is the link-hijack case peek exists to avoid; it must not toggle.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", altKey: true }));
    window.dispatchEvent(new PointerEvent("pointerdown"));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", altKey: false }));
    expect(layer().dataset.oooPeek).toBe("off");
  });

  test("panel state survives a remount (i.e. a page navigation)", () => {
    mount("<button>A</button>");
    (layer().querySelector(".ooo-switch--peek") as HTMLButtonElement).click();
    expect(layer().dataset.oooPeek).toBe("on");
    // A full page load on the multi-page docs site destroys and re-creates the
    // overlay; the saved peek state must come back so the nav click doesn't reset it.
    handle!.destroy();
    handle = trace({ root });
    expect(layer().dataset.oooPeek).toBe("on");
    expect(
      (layer().querySelector(".ooo-switch--peek") as HTMLButtonElement).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
  });

  test("hiding the overlay while peeking ends the peek for good", () => {
    mount("<button>A</button>");
    (layer().querySelector(".ooo-switch--peek") as HTMLButtonElement).click();
    expect(layer().dataset.oooPeek).toBe("on");
    handle!.setVisible(false);
    expect(layer().dataset.oooPeek).toBe("off");
    // The ghost path: hide while peeking, navigate, show, navigate again. The
    // stored peek must not silently come back on the second remount.
    handle!.destroy();
    handle = trace({ root });
    handle!.setVisible(true);
    handle!.destroy();
    handle = trace({ root });
    expect(layer().dataset.oooPeek).toBe("off");
    expect(
      (layer().querySelector(".ooo-switch--peek") as HTMLButtonElement).getAttribute(
        "aria-checked",
      ),
    ).toBe("false");
  });

  test("the panel is keyboard accessible and audits clean", () => {
    root = document.createElement("div");
    root.innerHTML = "<button>A</button>";
    document.body.appendChild(root);
    // Default root (document): the overlay's own panel is page content like any
    // other, so it is graded too and must pass its own audit.
    handle = trace();
    const title = layer().querySelector(".ooo-panel-title") as HTMLButtonElement;
    expect(title.tabIndex).toBe(0);
    // The page's button + title + two switches + copy button + caret, all clean.
    expect(handle.result!.sequence).toHaveLength(6);
    expect(flaggedEntries(handle.result!)).toHaveLength(0);
    expect(handle.result!.valid).toBe(true);
    // Graded but not drawn: no badges, rings, or hops on the overlay's own chrome.
    expect(numbered()).toHaveLength(1);
    expect(title.hasAttribute("data-ooo-ring")).toBe(false);
  });

  test("the copy menu is a roving-focus keyboard menu", () => {
    mount("<button>A</button>");
    const caret = layer().querySelector(".ooo-copy-caret") as HTMLButtonElement;
    const menu = layer().querySelector(".ooo-copy-menu") as HTMLElement;
    const items = Array.from(menu.querySelectorAll("button"));
    // One composite widget, no extra tab stops: the arrow keys rove between items.
    expect(items.every((item) => item.tabIndex === -1)).toBe(true);
    caret.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(menu.hidden).toBe(false);
    // Opens on the checked item (the default "by-element" format is second).
    expect(document.activeElement).toBe(items[1]);
    items[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(items[2]);
    items[2]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(caret);
  });

  test("setPeek flips click-through but never while hidden", () => {
    mount("<button>A</button>", { controls: false });
    handle!.setPeek(true);
    expect(handle!.peeking).toBe(true);
    expect(layer().dataset.oooPeek).toBe("on");
    handle!.setPeek(false);
    expect(layer().dataset.oooPeek).toBe("off");
    handle!.setVisible(false);
    handle!.setPeek(true);
    // Click-through is meaningless with nothing drawn.
    expect(handle!.peeking).toBe(false);
    expect(layer().dataset.oooPeek).toBe("off");
  });

  test("setMotion overrides the mode at runtime", () => {
    mount("<button>A</button>", { motion: "on" });
    expect(layer().dataset.oooMotion).toBe("play");
    handle!.setMotion("off");
    expect(layer().dataset.oooMotion).toBe("still");
    handle!.setMotion("on");
    expect(layer().dataset.oooMotion).toBe("play");
  });

  test("onStateChange reports visibility and peek flips from any source", () => {
    const onStateChange = vi.fn();
    mount("<button>A</button>", { controls: false, onStateChange });
    tapAlt();
    expect(onStateChange).toHaveBeenLastCalledWith({ visible: true, peeking: true });
    handle!.setVisible(false);
    // Hiding ends the peek; the last call reflects the settled state.
    expect(onStateChange).toHaveBeenLastCalledWith({ visible: false, peeking: false });
  });

  test("destroy removes the layer and un-marks elements", () => {
    mount("<button>A</button>");
    const button = root.querySelector("button")!;
    expect(button.getAttribute("data-ooo-ring")).toBe("ok");
    expect(button.hasAttribute("data-ooo-anchor")).toBe(true);
    handle!.destroy();
    handle = null;
    expect(document.querySelector(".ooo-layer")).toBeNull();
    expect(button.hasAttribute("data-ooo-ring")).toBe(false);
    expect(button.hasAttribute("data-ooo-anchor")).toBe(false);
  });

  test("onResult fires synchronously on mount and again on rebuild", async () => {
    root = document.createElement("div");
    root.innerHTML = "<button>A</button>";
    document.body.appendChild(root);
    const onResult = vi.fn();
    handle = trace({ root, onResult });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenLastCalledWith(handle.result);
    expect(handle.result!.sequence).toHaveLength(1);
    root.insertAdjacentHTML("beforeend", "<button>B</button>");
    await vi.waitFor(() => expect(onResult.mock.calls.length).toBeGreaterThan(1), {
      timeout: 2000,
    });
    expect(onResult.mock.lastCall![0].sequence).toHaveLength(2);
  });

  test("rebuilds when the page DOM changes", async () => {
    mount("<button>A</button>");
    expect(numbered()).toHaveLength(1);
    root.insertAdjacentHTML("beforeend", "<button>B</button>");
    await vi.waitFor(() => expect(numbered()).toHaveLength(2), {
      timeout: 2000,
    });
  });

  /** Viewport-space center distance between a badge and `el`. */
  const badgeDrift = (el: Element, badgeEl: Element = numbered()[0]!): number => {
    const badge = badgeEl.getBoundingClientRect();
    const target = el.getBoundingClientRect();
    return Math.hypot(
      badge.left + badge.width / 2 - (target.left + target.width / 2),
      badge.top + badge.height / 2 - (target.top + target.height / 2),
    );
  };

  test("a badge sits on its element's center", () => {
    mount('<button style="margin:200px;width:80px;height:40px">A</button>');
    expect(badgeDrift(root.querySelector("button")!)).toBeLessThan(1.5);
  });

  test("an element with its own anchor-name keeps it and still gets a badge", () => {
    mount(
      '<button style="margin:200px;width:80px;height:40px;anchor-name:--their-menu">A</button>',
    );
    const button = root.querySelector("button")!;
    // The page's name is reused, not clobbered or overridden by ours.
    expect(getComputedStyle(button).getPropertyValue("anchor-name")).toBe("--their-menu");
    expect(button.hasAttribute("data-ooo-anchor")).toBe(false);
    expect(badgeDrift(button)).toBeLessThan(1.5);
  });

  test("badges stay on their element across a window scroll", async () => {
    mount('<div style="height:3000px"></div><button>A</button>');
    const button = root.querySelector("button")!;
    window.scrollTo(0, 400);
    await vi.waitFor(() => expect(window.scrollY).toBe(400), { timeout: 2000 });
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    expect(badgeDrift(button)).toBeLessThan(1.5);
  });

  test("a fixed element's badge follows it through a window scroll", async () => {
    // The fixed element keeps its viewport spot while the page scrolls under it;
    // the anchored badge must stay glued without any JS repositioning.
    mount(
      '<div style="height:3000px"></div>' +
        '<button style="position:fixed;top:10px;left:10px;width:80px;height:40px">A</button>',
    );
    const button = root.querySelector("button")!;
    window.scrollTo(0, 300);
    await vi.waitFor(() => expect(window.scrollY).toBe(300), { timeout: 2000 });
    await vi.waitFor(() => expect(badgeDrift(button)).toBeLessThan(1.5), { timeout: 2000 });
  });

  /** Max edge distance between the live hop candidate's box and the span of the
      two elements' centers (the box the quadrant scheme should produce). */
  const hopDrift = (a: Element, b: Element): number => {
    const center = (el: Element): [number, number] => {
      const rect = el.getBoundingClientRect();
      return [rect.left + rect.width / 2, rect.top + rect.height / 2];
    };
    const live = [...document.querySelectorAll(".ooo-hop")].find(
      (hop) => getComputedStyle(hop.querySelector(".ooo-hop-line")!).display !== "none",
    );
    if (!live) {
      return Infinity;
    }
    const rect = live.getBoundingClientRect();
    const [ax, ay] = center(a);
    const [bx, by] = center(b);
    return Math.max(
      Math.abs(rect.left - (Math.min(ax, bx) - 0.5)),
      Math.abs(rect.top - (Math.min(ay, by) - 0.5)),
      Math.abs(rect.right - (Math.max(ax, bx) + 0.5)),
      Math.abs(rect.bottom - (Math.max(ay, by) + 0.5)),
    );
  };

  test("a seam hop (fixed to in-flow) hides while scrolling and returns glued", async () => {
    mount(
      '<button style="position:fixed;top:10px;left:10px;width:80px;height:40px">A</button>' +
        '<div style="height:3000px"></div>' +
        '<button style="width:80px;height:40px">B</button>',
    );
    const [a, b] = [...root.querySelectorAll("button")];
    // A seam hop spans two scroll regimes, so it is placed from live geometry
    // rather than riding a CSS anchor like the other hops.
    expect(document.querySelectorAll(".ooo-hop")).toHaveLength(1);
    expect(hopDrift(a!, b!)).toBeLessThan(2);
    window.scrollTo(0, 400);
    // Mid-scroll the seam hop ducks out instead of swimming behind the badges.
    await vi.waitFor(() => expect(layer().dataset.oooShifting).toBe("on"), { timeout: 2000 });
    // Once the scroll settles it comes back, freshly placed.
    await vi.waitFor(() => expect(layer().dataset.oooShifting).toBeUndefined(), {
      timeout: 2000,
    });
    expect(window.scrollY).toBe(400);
    expect(hopDrift(a!, b!)).toBeLessThan(2);
  });

  test("a badge follows its element inside a scrolled nested container", async () => {
    mount(
      '<div id="scroller" style="height:100px;overflow:auto">' +
        '<div style="height:200px"></div><button>A</button></div>',
    );
    const button = root.querySelector("button")!;
    root.querySelector("#scroller")!.scrollTop = 150;
    await vi.waitFor(() => expect(badgeDrift(button)).toBeLessThan(1.5), { timeout: 2000 });
  });

  test("an SVG anchor (no CSS box) gets a JS-placed badge on its element", () => {
    // anchor-name no-ops on SVG layout elements, so the badge can't ride a CSS
    // anchor; it's placed from live geometry instead, and must still land on the
    // link rather than collapsing to the layer origin.
    mount(
      '<button style="width:80px;height:40px">A</button>' +
        '<svg width="120" height="40"><a href="#" aria-label="svg link">' +
        '<text x="12" y="25">B</text></a></svg>',
    );
    const svgAnchor = root.querySelector("svg a")!;
    expect(numbered()).toHaveLength(2);
    // No anchor attribute published for it (it could never anchor), and its badge
    // carries an inline position instead of the --ooo-anchor custom property.
    expect(svgAnchor.hasAttribute("data-ooo-anchor")).toBe(false);
    const svgBadge = numbered()[1]!;
    expect((svgBadge as HTMLElement).style.getPropertyValue("--ooo-anchor")).toBe("");
    expect(badgeDrift(svgAnchor, svgBadge)).toBeLessThan(1.5);
    // The hop into the SVG stop can't ride a CSS anchor, so it's a JS-placed seam box.
    expect(layer().querySelectorAll(".ooo-hop")).toHaveLength(1);
    expect(hopDrift(root.querySelector("button")!, svgAnchor)).toBeLessThan(2);
  });

  test("shadow-DOM stops get badges, and hops cross the boundary", async () => {
    mount("<button>Light</button>");
    // The host arrives after trace() mounted, so its shadow root must be picked up
    // by the rebuild that its (light DOM) insertion triggers.
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = "<button>A</button>";
    root.appendChild(host);
    await vi.waitFor(() => expect(handle!.result!.sequence).toHaveLength(2), { timeout: 2000 });
    // Badges draw in the main layer, anchored across the boundary via ::part.
    await vi.waitFor(() => expect(numbered()).toHaveLength(2), { timeout: 2000 });
    const inner = shadow.querySelector("button")!;
    expect(inner.getAttribute("data-ooo-ring")).toBe("ok");
    expect(badgeDrift(inner, numbered()[1]!)).toBeLessThan(1.5);
    // The light->shadow hop rides CSS anchors across the boundary (::part) as a single box.
    expect(layer().querySelectorAll(".ooo-hop")).toHaveLength(1);
    expect(hopDrift(root.querySelector("button")!, inner)).toBeLessThan(2);
    // This mutation happens inside the shadow root only; no light-DOM node changes.
    shadow.innerHTML = "<button>A</button><button>B</button>";
    await vi.waitFor(() => expect(numbered()).toHaveLength(3), { timeout: 2000 });
    // Destroy releases the part tokens the anchors rode on.
    handle!.destroy();
    handle = null;
    expect(shadow.querySelector("button")!.part.length).toBe(0);
  });
});
