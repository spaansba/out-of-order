import { afterEach, describe, expect, test } from "vitest";
import { isInteractive, selectorFor } from "../src/index.js";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Render `html` and return its first element (the test subject). */
function el(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
}

describe("selectorFor", () => {
  test("keeps the first id and first class, joined with >", () => {
    document.body.innerHTML =
      '<div id="card" class="ignored"><button class="btn alt">B</button></div>';
    // id short-circuits the div (its class is dropped); only the first class of
    // the button survives.
    expect(selectorFor(document.querySelector("button")!)).toBe("div#card > button.btn");
  });

  test("caps the path at four ancestors", () => {
    document.body.innerHTML =
      "<section><article><div><span><button>X</button></span></div></article></section>";
    // section and body are beyond the depth cap, so they're left off.
    expect(selectorFor(document.querySelector("button")!)).toBe("article > div > span > button");
  });
});

describe("isInteractive", () => {
  test("native controls and a link with href need a name", () => {
    for (const html of [
      "<button>x</button>",
      '<a href="#">x</a>',
      "<select></select>",
      "<textarea></textarea>",
      "<summary>x</summary>",
      "<input>",
    ]) {
      expect(isInteractive(el(html)), html).toBe(true);
    }
  });

  test("a hidden input and an href-less anchor do not", () => {
    expect(isInteractive(el('<input type="hidden">'))).toBe(false);
    expect(isInteractive(el("<a>no href</a>"))).toBe(false);
  });

  test("an interactive ARIA role counts, a non-interactive one does not", () => {
    expect(isInteractive(el('<div role="checkbox">x</div>'))).toBe(true);
    expect(isInteractive(el('<div role="presentation">x</div>'))).toBe(false);
    expect(isInteractive(el("<div>plain</div>"))).toBe(false);
  });
});
