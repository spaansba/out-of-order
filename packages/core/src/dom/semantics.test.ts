import { afterEach, describe, expect, test } from "vitest";
import { isInteractive } from "./semantics.js";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Render `html` and return its first element (the test subject). */
function el(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
}

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

  test("a multi-token role resolves to its first token", () => {
    expect(isInteractive(el('<div role="button link">x</div>'))).toBe(true);
    expect(isInteractive(el('<div role=" presentation button ">x</div>'))).toBe(false);
  });
});
