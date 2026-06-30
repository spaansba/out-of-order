import { afterEach, describe, expect, test, vi } from "vitest";
import { reveal, type RevealHandle } from "../src/index.js";

let handle: RevealHandle | null = null;
let root: HTMLElement;

/** Mount a fresh, scoped overlay over `html`. */
function mount(html: string): RevealHandle {
  root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  handle = reveal({ root });
  return handle;
}

const layer = (): HTMLElement => document.querySelector(".fp-layer")!;
const numbered = (): NodeListOf<Element> =>
  layer().querySelectorAll(".fp-badge:not(.fp-badge--off)");

afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.innerHTML = "";
});

describe("reveal", () => {
  test("appends a tagged overlay layer", () => {
    mount("<button>A</button>");
    expect(layer().getAttribute("data-focuspocus-overlay")).toBe("");
  });

  test("draws one numbered badge per tab stop", () => {
    mount('<button>A</button><a href="#">B</a><input aria-label="C">');
    expect(numbered()).toHaveLength(3);
    expect(handle!.result!.sequence).toHaveLength(3);
  });

  test("rings and badges a violating stop in red", () => {
    mount('<button>Fine</button><button tabindex="2">Jumped</button>');
    expect(layer().querySelector(".fp-badge--bad")).not.toBeNull();
    expect(
      root.querySelector('[tabindex="2"]')!.classList.contains("fp-ring--bad"),
    ).toBe(true);
  });

  test("marks an interactive-but-unreachable control with an off-sequence glyph", () => {
    mount('<div role="button" onclick="x()">Ghost</div>');
    const off = layer().querySelector(".fp-badge--off");
    expect(off).not.toBeNull();
    expect(off!.textContent).toBe("⊘");
    expect(numbered()).toHaveLength(0);
  });

  test("setVisible hides the drawing but keeps the panel", () => {
    mount("<button>A</button>");
    handle!.setVisible(false);
    expect(layer().classList.contains("fp-hidden")).toBe(true);
    // The control panel shares the layer and stays put, so "Show overlay" is reachable.
    expect(layer().querySelector(".fp-panel")).not.toBeNull();
    handle!.setVisible(true);
    expect(layer().classList.contains("fp-hidden")).toBe(false);
  });

  test("the panel's show/hide button toggles the overlay and relabels", () => {
    mount("<button>A</button>");
    const vis = layer().querySelector(".fp-panel-vis") as HTMLButtonElement;
    expect(vis.textContent).toBe("Hide overlay");
    expect(vis.classList.contains("fp-panel-btn--on")).toBe(false);
    vis.click();
    expect(handle!.visible).toBe(false);
    expect(layer().classList.contains("fp-hidden")).toBe(true);
    expect(vis.textContent).toBe("Show overlay");
    // Lit accent while hidden, mirroring the peek button's active state.
    expect(vis.classList.contains("fp-panel-btn--on")).toBe(true);
    vis.click();
    expect(handle!.visible).toBe(true);
    expect(vis.textContent).toBe("Hide overlay");
  });

  const tapAlt = (): void => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", altKey: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", altKey: false }));
  };

  test("tapping the peek modifier toggles click-through, then back", () => {
    mount("<button>A</button>");
    // Default peek key is Alt: a lone tap turns the overlay click-through.
    tapAlt();
    expect(layer().dataset.fpPeek).toBe("on");
    tapAlt();
    expect(layer().dataset.fpPeek).toBe("off");
  });

  test("the panel's peek button is non-tabbable and toggles peek on click", () => {
    mount("<button>A</button>");
    const peek = layer().querySelector(".fp-panel-peek") as HTMLButtonElement;
    expect(peek).not.toBeNull();
    // Kept out of the page's own tab order, so the analyzer never numbers it.
    expect(peek.tabIndex).toBe(-1);
    expect(peek.textContent!.toLowerCase()).toContain("click");
    peek.click();
    expect(layer().dataset.fpPeek).toBe("on");
    expect(peek.classList.contains("fp-panel-btn--on")).toBe(true);
    peek.click();
    expect(layer().dataset.fpPeek).toBe("off");
  });

  test("hiding the overlay disables the peek button", () => {
    mount("<button>A</button>");
    const peek = layer().querySelector(".fp-panel-peek") as HTMLButtonElement;
    expect(peek.disabled).toBe(false);
    handle!.setVisible(false);
    // Peek is meaningless with nothing drawn, so it's disabled while hidden.
    expect(peek.disabled).toBe(true);
    handle!.setVisible(true);
    expect(peek.disabled).toBe(false);
  });

  test("the header collapses and expands the panel", () => {
    mount("<button>A</button>");
    const panel = layer().querySelector(".fp-panel") as HTMLElement;
    const head = layer().querySelector(".fp-panel-head") as HTMLButtonElement;
    expect(panel.dataset.open).toBe("1");
    head.click();
    expect(panel.dataset.open).toBe("0");
    head.click();
    expect(panel.dataset.open).toBe("1");
  });

  test("a modifier combo (not a lone tap) doesn't toggle peek", () => {
    mount("<button>A</button>");
    // Alt+Tab style: another key joins the press, so it isn't a peek tap.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", altKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", altKey: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", altKey: false }));
    expect(layer().dataset.fpPeek).toBe("off");
  });

  test("a click between press and release doesn't toggle peek", () => {
    mount("<button>A</button>");
    // Hold-and-click is the link-hijack case peek exists to avoid; it must not toggle.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt", altKey: true }));
    window.dispatchEvent(new PointerEvent("pointerdown"));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", altKey: false }));
    expect(layer().dataset.fpPeek).toBe("off");
  });

  test("destroy removes the layer and un-rings elements", () => {
    mount("<button>A</button>");
    const button = root.querySelector("button")!;
    expect(button.classList.contains("fp-ring")).toBe(true);
    handle!.destroy();
    handle = null;
    expect(document.querySelector(".fp-layer")).toBeNull();
    expect(button.classList.contains("fp-ring")).toBe(false);
  });

  test("rebuilds when the page DOM changes", async () => {
    mount("<button>A</button>");
    expect(numbered()).toHaveLength(1);
    root.insertAdjacentHTML("beforeend", "<button>B</button>");
    await vi.waitFor(() => expect(numbered()).toHaveLength(2), {
      timeout: 2000,
    });
  });
});
