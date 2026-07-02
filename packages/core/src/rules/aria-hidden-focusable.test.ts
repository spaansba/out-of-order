import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("aria-hidden-focusable", () => {
  test("01 visible button with no aria-hidden passes", () => {
    expect(fired("<button>Save</button>")).not.toContain("aria-hidden-focusable");
  });
  test("02 aria-hidden container with control removed via tabindex=-1 passes", () => {
    expect(
      fired(
        '<button>Visible</button><div aria-hidden="true"><button tabindex="-1">Hidden</button></div>',
      ),
    ).not.toContain("aria-hidden-focusable");
  });
  test("03 aria-hidden on decorative non-focusable content passes", () => {
    expect(
      fired('<span aria-hidden="true">decorative star</span><button>Rate</button>'),
    ).not.toContain("aria-hidden-focusable");
  });
  test("04 aria-hidden=false on a focusable link passes", () => {
    expect(fired('<div aria-hidden="false"><a href="#profile">Profile</a></div>')).not.toContain(
      "aria-hidden-focusable",
    );
  });
  test("05 native button inside aria-hidden=true fails", () => {
    expect(fired('<div aria-hidden="true"><button>Buy now</button></div>')).toContain(
      "aria-hidden-focusable",
    );
  });
  test("06 div with tabindex=0 and aria-hidden=true on itself fails", () => {
    expect(fired('<div tabindex="0" aria-hidden="true">Hidden stop</div>')).toContain(
      "aria-hidden-focusable",
    );
  });
  test("07 aria-hidden=false nested inside aria-hidden=true fails (flag is correct, not a false positive)", () => {
    expect(
      fired('<div aria-hidden="true"><span aria-hidden="false"><button>X</button></span></div>'),
    ).toContain("aria-hidden-focusable");
  });
  test("08 link inside aria-hidden=true fails", () => {
    expect(fired('<div aria-hidden="true"><a href="#section">Skip to section</a></div>')).toContain(
      "aria-hidden-focusable",
    );
  });
  test.fails("09 REGRESSION (CI-1): uppercase aria-hidden=TRUE should fail but currently passes", () => {
    expect(fired('<div aria-hidden="TRUE"><button>Buy now</button></div>')).toContain(
      "aria-hidden-focusable",
    );
  });
  test.fails("10 REGRESSION (CI-2): whitespace aria-hidden=' true ' should fail but currently passes", () => {
    expect(fired('<div aria-hidden=" true "><button>Buy now</button></div>')).toContain(
      "aria-hidden-focusable",
    );
  });
  test("11 aria-hidden='' (empty) passes -- guards the CI-1/CI-2 fix against over-matching", () => {
    expect(fired('<div aria-hidden=""><button>OK</button></div>')).not.toContain(
      "aria-hidden-focusable",
    );
  });
});
