import { afterEach, describe, expect, test, vi } from "vitest";
import { mountOverlay, type OverlayHandle } from "../src/overlay.js";

let handle: OverlayHandle | null = null;
let root: HTMLElement;

/** Mount a fresh, scoped overlay over `html`. */
function mount(html: string): OverlayHandle {
  root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  handle = mountOverlay({ root });
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

describe("mountOverlay", () => {
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

  test("setVisible toggles the layer", () => {
    mount("<button>A</button>");
    handle!.setVisible(false);
    expect(layer().style.display).toBe("none");
    handle!.setVisible(true);
    expect(layer().style.display).toBe("");
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

  test("exclude skips a subtree so it isn't numbered", () => {
    root = document.createElement("div");
    root.innerHTML = '<button>A</button><div id="ex"><button>B</button></div>';
    document.body.appendChild(root);
    handle = mountOverlay({ root, exclude: root.querySelector("#ex") });
    expect(numbered()).toHaveLength(1); // only the non-excluded button
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
