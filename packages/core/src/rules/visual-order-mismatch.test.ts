import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("visual-order-mismatch", () => {
  test("01 RTL toolbar row is valid (CI-1: reading order follows dir=rtl)", () => {
    expect(
      fired(
        '<div dir="rtl" style="display:flex; gap:10px; width:300px;"><button>الأول</button><button>الثاني</button><button>الثالث</button></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("02 CSS multi-column link list is valid (CI-2: column break is a forward advance)", () => {
    expect(
      fired(
        '<div style="column-count:2; column-fill:auto; column-gap:30px; width:300px; height:50px; line-height:24px;"><a href="#1">One</a><br><a href="#2">Two</a><br><a href="#3">Three</a><br><a href="#4">Four</a></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("03 Tall sidebar beside short content link is valid", () => {
    expect(
      fired(
        '<div style="display:flex; gap:10px; align-items:flex-start;"><a href="#" style="display:inline-block; height:300px;">Sidebar</a><a href="#" style="display:inline-block; height:20px;">MainTop</a></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("04 Focusable container with a child near its top is valid (CI-3: containment skip)", () => {
    expect(
      fired(
        '<div tabindex="0" style="height:200px; border:1px solid black;"><button style="margin-top:0;">Child</button></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("05 writing-mode:vertical-rl block layout is valid (CI-4: lines stack right→left)", () => {
    expect(
      fired(
        '<div style="writing-mode:vertical-rl; height:80px; width:200px;"><div><button>A</button></div><div><button>B</button></div><div><button>C</button></div></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("06 Differing heights but align-items:center is valid (PASSES today - guard / contrast with CI-3)", () => {
    expect(
      fired(
        '<div style="display:flex; align-items:center; gap:10px;"><a href="#" style="display:inline-block; height:100px;">Tall</a><a href="#" style="display:inline-block; height:20px;">Short</a></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("07 Wrapped flex grid in source order is valid (PASSES today - guard)", () => {
    expect(
      fired(
        '<div style="display:flex; flex-wrap:wrap; width:120px; gap:10px;"><button style="width:50px;">1</button><button style="width:50px;">2</button><button style="width:50px;">3</button><button style="width:50px;">4</button></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("08 Sticky navbar over scrolling content is valid (PASSES today - scroll-context skip guard)", () => {
    expect(
      fired(
        '<header style="position:sticky; top:0;"><a href="#home">Home</a></header><main><button style="margin-top:40px;">Body</button></main>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("09 2x2 grid read row-major is valid (PASSES today - guard)", () => {
    expect(
      fired(
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; width:200px;"><button>1</button><button>2</button><button>3</button><button>4</button></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("10 Two co-centered overlapping buttons are valid (PASSES today - x-fudge guard)", () => {
    expect(
      fired(
        '<div style="position:relative; width:100px; height:40px;"><button style="position:absolute; top:0; left:0; width:100px; height:40px;">A</button><button style="position:absolute; top:0; left:0; width:100px; height:40px;">B</button></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("11 flex-direction:row-reverse visually reverses a row - flagged (PASSES-as-fail today, true-positive guard)", () => {
    expect(
      fired(
        '<div style="display:flex; flex-direction:row-reverse; gap:10px; width:300px;"><button>A</button><button>B</button><button>C</button></div>',
      ),
    ).toContain("visual-order-mismatch");
  });
  test("12 Absolute positioning paints B above A - flagged (true-positive guard)", () => {
    expect(
      fired(
        '<div style="position:relative; height:120px;"><button style="position:absolute; top:80px; left:0;">A</button><button style="position:absolute; top:0; left:0;">B</button></div>',
      ),
    ).toContain("visual-order-mismatch");
  });
  test("13 transform:translateY lifts a later stop above an earlier one - flagged (true-positive guard)", () => {
    expect(
      fired(
        '<div style="display:flex; flex-direction:column; gap:4px;"><button>First</button><button style="transform:translateY(-60px);">Second</button><button>Third</button></div>',
      ),
    ).toContain("visual-order-mismatch");
  });
  test("14 flex `order` swaps two stops left/right - flagged (true-positive guard)", () => {
    expect(
      fired(
        '<div style="display:flex; gap:10px; width:300px;"><button style="order:2;">A</button><button style="order:1;">B</button></div>',
      ),
    ).toContain("visual-order-mismatch");
  });
  test("15 RTL + row-reverse (visually LTR, backwards for RTL) is flagged (CI-5)", () => {
    expect(
      fired(
        '<div dir="rtl" style="display:flex; flex-direction:row-reverse; gap:10px; width:300px;"><button>الأول</button><button>الثاني</button><button>الثالث</button></div>',
      ),
    ).toContain("visual-order-mismatch");
  });
  test("16 A stop below the fold of a scroll container vs an outside stop is valid (scroll-context skip guard)", () => {
    // The in-scroller button is laid out 200px down (below the 60px visible
    // fold), so its viewport y sits *below* the button that follows it outside
    // the scroller - a "backward hop" purely because the scroll container offsets
    // it. Different scroll ancestors, so the pair must be skipped.
    expect(
      fired(
        '<div style="height:60px; overflow:auto;"><div style="height:200px;"></div><button>Below the fold</button></div><button>After the scroller</button>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
  test("17 Two reversed stops inside the SAME scroll container are still flagged (true-positive guard)", () => {
    // Both stops share one scroll ancestor, so the guard does NOT apply: B paints
    // above A while coming later in the tab order - a real backward hop.
    expect(
      fired(
        '<div style="height:200px; overflow:auto; position:relative;"><button style="position:absolute; top:80px; left:0;">A</button><button style="position:absolute; top:0; left:0;">B</button></div>',
      ),
    ).toContain("visual-order-mismatch");
  });
  test("18 Later stop drawn inside an earlier sibling's box is valid (enclosure guard)", () => {
    // The button is a DOM sibling of the card link but paints inside its rect,
    // so there is no meaningful before/after between them.
    expect(
      fired(
        '<div style="position:relative;"><a href="#" style="display:block; width:300px; height:100px;">Card</a><button style="position:absolute; top:8px; left:8px;">Save</button></div>',
      ),
    ).not.toContain("visual-order-mismatch");
  });
});
