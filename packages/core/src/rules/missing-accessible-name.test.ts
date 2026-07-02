import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("missing-accessible-name", () => {
  test("01 button with visible text is named (control)", () => {
    expect(fired("<button>Save</button>")).not.toContain("missing-accessible-name");
  });
  test("02 title-only button is named (ACCNAME last resort)", () => {
    expect(fired('<button title="Close"></button>')).not.toContain("missing-accessible-name");
  });
  test("03 aria-labelledby to a hidden element still names", () => {
    expect(
      fired('<span id="t" hidden>Settings</span><button aria-labelledby="t"></button>'),
    ).not.toContain("missing-accessible-name");
  });
  test("04 sr-only label + aria-hidden icon is named", () => {
    expect(
      fired(
        '<button><span aria-hidden="true">★</span><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Favorite</span></button>',
      ),
    ).not.toContain("missing-accessible-name");
  });
  test("05 input[type=image] with alt is named (via the image alt)", () => {
    expect(fired('<input type="image" src="data:," alt="Search">')).not.toContain(
      "missing-accessible-name",
    );
  });
  test("06 aria-labelledby to svg[aria-label] is named", () => {
    expect(
      fired(
        '<button aria-labelledby="i"></button><svg id="i" aria-label="Close" width="16" height="16"></svg>',
      ),
    ).not.toContain("missing-accessible-name");
  });
  test("07 label with only an image alt names the input", () => {
    expect(
      fired('<label for="u"><img src="data:," alt="Username"></label><input id="u">'),
    ).not.toContain("missing-accessible-name");
  });
  test("08 bare submit button is named (implicit submit label)", () => {
    expect(fired('<input type="submit">')).not.toContain("missing-accessible-name");
  });
  test("09 unlabeled <select> is flagged (name not from its options)", () => {
    expect(fired("<select><option>Red</option><option>Blue</option></select>")).toContain(
      "missing-accessible-name",
    );
  });
  test("10 icon-only button with an aria-hidden glyph is flagged", () => {
    expect(
      fired('<button><span class="material-icons" aria-hidden="true">delete</span></button>'),
    ).toContain("missing-accessible-name");
  });
  test("11 custom role=textbox with content is flagged (name not from contents)", () => {
    expect(fired('<div role="textbox" tabindex="0">Enter your name</div>')).toContain(
      "missing-accessible-name",
    );
  });
  test("12 empty button is correctly flagged (true-positive control)", () => {
    expect(fired("<button></button>")).toContain("missing-accessible-name");
  });
});
