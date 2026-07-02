import { afterEach, describe, expect, test } from "vitest";
import { selectorFor } from "./selector.js";

afterEach(() => {
  document.body.innerHTML = "";
});

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

  test("disambiguates same-tag siblings with :nth-of-type", () => {
    document.body.innerHTML = "<div><button>A</button><button>B</button><a href='#'>C</a></div>";
    const buttons = document.querySelectorAll("button");
    expect(selectorFor(buttons[0]!)).toBe("html > body > div > button:nth-of-type(1)");
    expect(selectorFor(buttons[1]!)).toBe("html > body > div > button:nth-of-type(2)");
    // The lone <a> has no same-tag sibling, so it stays plain.
    expect(selectorFor(document.querySelector("a")!)).toBe("html > body > div > a");
  });
});
