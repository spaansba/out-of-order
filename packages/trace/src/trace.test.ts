import { afterEach, describe, expect, test, vi } from "vitest";
import { trace, type TraceHandle } from "./index.js";

let handle: TraceHandle | null = null;
let root: HTMLElement;

/** Mount a fresh, scoped overlay over `html`. */
function mount(html: string): TraceHandle {
  root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  handle = trace({ root });
  return handle;
}

const layer = (): HTMLElement => document.querySelector(".ooo-layer")!;
const numbered = (): NodeListOf<Element> =>
  layer().querySelectorAll(".ooo-badge:not(.ooo-badge--off)");

afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.innerHTML = "";
  // Panel state persists in sessionStorage; clear it so tests don't leak into each other.
  sessionStorage.clear();
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
    expect(handle.result!.violations).toHaveLength(0);
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

  test("destroy removes the layer and un-rings elements", () => {
    mount("<button>A</button>");
    const button = root.querySelector("button")!;
    expect(button.getAttribute("data-ooo-ring")).toBe("ok");
    handle!.destroy();
    handle = null;
    expect(document.querySelector(".ooo-layer")).toBeNull();
    expect(button.hasAttribute("data-ooo-ring")).toBe(false);
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

  test("rebuilds when content inside a shadow root changes", async () => {
    mount("");
    // The host arrives after trace() mounted, so its shadow root must be picked up
    // by the rebuild that its (light DOM) insertion triggers.
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = "<button>A</button>";
    root.appendChild(host);
    await vi.waitFor(() => expect(numbered()).toHaveLength(1), { timeout: 2000 });
    // This mutation happens inside the shadow root only; no light-DOM node changes.
    shadow.innerHTML = "<button>A</button><button>B</button>";
    await vi.waitFor(() => expect(numbered()).toHaveLength(2), { timeout: 2000 });
  });
});
