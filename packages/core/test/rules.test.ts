import { afterEach, describe, expect, test } from "vitest";
import { audit } from "../src/index.js";

afterEach(() => {
  document.body.innerHTML = "";
});

function fired(html: string): Set<string> {
  document.body.innerHTML = html;
  return new Set(audit(document.body).violations.map((v) => v.rule));
}

describe("no-positive-tabindex", () => {
  // cited source is arguably mismatched (audit suggests: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
  test("01 passes: plain controls with no tabindex", () => {
    expect(fired('<button>A</button><a href="#x">B</a>')).not.toContain(
      "no-positive-tabindex",
    );
  });
  test('02 passes: tabindex="0" is allowed', () => {
    expect(fired('<div tabindex="0">Region</div>')).not.toContain(
      "no-positive-tabindex",
    );
  });
  test('03 passes: tabindex="-1" is not in the sequence', () => {
    expect(
      fired('<button>A</button><span tabindex="-1">B</span>'),
    ).not.toContain("no-positive-tabindex");
  });
  test('04 fails: tabindex="1" hijacks the order', () => {
    expect(
      fired('<button>A</button><button tabindex="1">Jumped to front</button>'),
    ).toContain("no-positive-tabindex");
  });
  test("05 fails: fractional tabindex truncated to 2 by the browser", () => {
    expect(
      fired('<button>a</button><button tabindex="2.9">b</button>'),
    ).toContain("no-positive-tabindex");
  });
  test.fails(
    "06 should pass but currently FAILS: out-of-range tabindex reset to 0 by Chromium",
    () => {
      expect(
        fired(
          '<button>Save</button><button tabindex="99999999999">Cancel</button>',
        ),
      ).not.toContain("no-positive-tabindex");
    },
  );
  test.fails(
    '07 should fail but currently PASSES: tabindex="3px" parsed positive by Chromium',
    () => {
      expect(
        fired(
          '<button>First</button><button tabindex="3px">Jumped to front</button>',
        ),
      ).toContain("no-positive-tabindex");
    },
  );
  test("08 flags a meaning-preserving positive-tabindex order (best-practice vs 2.4.3)", () => {
    expect(
      fired(
        '<button tabindex="1">First</button><button tabindex="2">Second</button><button tabindex="3">Third</button>',
      ),
    ).toContain("no-positive-tabindex");
  });
});

describe("visual-order-mismatch", () => {
  // cited source is the right authority (audit suggests: https://www.w3.org/WAI/WCAG22/Techniques/css/C27 (and SC 1.3.2 Meaningful Sequence: https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html))
  test.fails(
    "01 RTL toolbar row is valid (currently FAILS - CI-1 false positive)",
    () => {
      expect(
        fired(
          '<div dir="rtl" style="display:flex; gap:10px; width:300px;"><button>الأول</button><button>الثاني</button><button>الثالث</button></div>',
        ),
      ).not.toContain("visual-order-mismatch");
    },
  );
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
  test.fails(
    "04 Focusable container with a child near its top is valid (currently FAILS - CI-3 overlap variant)",
    () => {
      expect(
        fired(
          '<div tabindex="0" style="height:200px; border:1px solid black;"><button style="margin-top:0;">Child</button></div>',
        ),
      ).not.toContain("visual-order-mismatch");
    },
  );
  test.fails(
    "05 writing-mode:vertical-rl block layout is valid (currently FAILS - CI-4 false positive)",
    () => {
      expect(
        fired(
          '<div style="writing-mode:vertical-rl; height:80px; width:200px;"><div><button>A</button></div><div><button>B</button></div><div><button>C</button></div></div>',
        ),
      ).not.toContain("visual-order-mismatch");
    },
  );
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
  test.fails(
    "15 RTL + row-reverse (visually LTR, backwards for RTL) is NOT flagged - documents false negative (CI-5)",
    () => {
      expect(
        fired(
          '<div dir="rtl" style="display:flex; flex-direction:row-reverse; gap:10px; width:300px;"><button>الأول</button><button>الثاني</button><button>الثالث</button></div>',
        ),
      ).toContain("visual-order-mismatch");
    },
  );
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
});

describe("missing-accessible-name", () => {
  // cited source is the right authority
  test("01 button with visible text is named (control)", () => {
    expect(fired("<button>Save</button>")).not.toContain(
      "missing-accessible-name",
    );
  });
  test("02 title-only button is named (ACCNAME last resort)", () => {
    expect(fired('<button title="Close"></button>')).not.toContain(
      "missing-accessible-name",
    );
  });
  test("03 aria-labelledby to a hidden element still names", () => {
    expect(
      fired(
        '<span id="t" hidden>Settings</span><button aria-labelledby="t"></button>',
      ),
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
    expect(
      fired('<input type="image" src="data:," alt="Search">'),
    ).not.toContain("missing-accessible-name");
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
      fired(
        '<label for="u"><img src="data:," alt="Username"></label><input id="u">',
      ),
    ).not.toContain("missing-accessible-name");
  });
  test("08 bare submit button is named (implicit submit label)", () => {
    expect(fired('<input type="submit">')).not.toContain(
      "missing-accessible-name",
    );
  });
  test("09 unlabeled <select> is flagged (name not from its options)", () => {
    expect(
      fired("<select><option>Red</option><option>Blue</option></select>"),
    ).toContain("missing-accessible-name");
  });
  test("10 icon-only button with an aria-hidden glyph is flagged", () => {
    expect(
      fired(
        '<button><span class="material-icons" aria-hidden="true">delete</span></button>',
      ),
    ).toContain("missing-accessible-name");
  });
  test("11 custom role=textbox with content is flagged (name not from contents)", () => {
    expect(
      fired('<div role="textbox" tabindex="0">Enter your name</div>'),
    ).toContain("missing-accessible-name");
  });
  test("12 empty button is correctly flagged (true-positive control)", () => {
    expect(fired("<button></button>")).toContain("missing-accessible-name");
  });
});

describe("aria-hidden-focusable", () => {
  // cited source is arguably mismatched (audit suggests: https://www.w3.org/TR/using-aria/#fourth)
  test("01 visible button with no aria-hidden passes", () => {
    expect(fired("<button>Save</button>")).not.toContain(
      "aria-hidden-focusable",
    );
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
      fired(
        '<span aria-hidden="true">decorative star</span><button>Rate</button>',
      ),
    ).not.toContain("aria-hidden-focusable");
  });
  test("04 aria-hidden=false on a focusable link passes", () => {
    expect(
      fired('<div aria-hidden="false"><a href="#profile">Profile</a></div>'),
    ).not.toContain("aria-hidden-focusable");
  });
  test("05 native button inside aria-hidden=true fails", () => {
    expect(
      fired('<div aria-hidden="true"><button>Buy now</button></div>'),
    ).toContain("aria-hidden-focusable");
  });
  test("06 div with tabindex=0 and aria-hidden=true on itself fails", () => {
    expect(
      fired('<div tabindex="0" aria-hidden="true">Hidden stop</div>'),
    ).toContain("aria-hidden-focusable");
  });
  test("07 aria-hidden=false nested inside aria-hidden=true fails (flag is correct, not a false positive)", () => {
    expect(
      fired(
        '<div aria-hidden="true"><span aria-hidden="false"><button>X</button></span></div>',
      ),
    ).toContain("aria-hidden-focusable");
  });
  test("08 link inside aria-hidden=true fails", () => {
    expect(
      fired(
        '<div aria-hidden="true"><a href="#section">Skip to section</a></div>',
      ),
    ).toContain("aria-hidden-focusable");
  });
  test.fails(
    "09 REGRESSION (CI-1): uppercase aria-hidden=TRUE should fail but currently passes",
    () => {
      expect(
        fired('<div aria-hidden="TRUE"><button>Buy now</button></div>'),
      ).toContain("aria-hidden-focusable");
    },
  );
  test.fails(
    "10 REGRESSION (CI-2): whitespace aria-hidden=' true ' should fail but currently passes",
    () => {
      expect(
        fired('<div aria-hidden=" true "><button>Buy now</button></div>'),
      ).toContain("aria-hidden-focusable");
    },
  );
  test("11 aria-hidden='' (empty) passes -- guards the CI-1/CI-2 fix against over-matching", () => {
    expect(
      fired('<div aria-hidden=""><button>OK</button></div>'),
    ).not.toContain("aria-hidden-focusable");
  });
});

describe("hidden-while-focusable", () => {
  // cited source is the right authority
  test("01 sr-only clip skip link passes (exemption works)", () => {
    expect(
      fired(
        '<a href="#main" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap">Skip to content</a><button>Real</button>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test.fails(
    "02 off-screen skip link revealed on focus should pass (CI-1 false positive)",
    () => {
      expect(
        fired(
          '<style>.skip{position:absolute;left:-9999px;top:auto}.skip:focus{left:8px;top:8px}</style><a href="#main" class="skip">Skip to content</a><button>Real</button>',
        ),
      ).not.toContain("hidden-while-focusable");
    },
  );
  test.fails(
    "03 opacity:0 control revealed on focus should pass (CI-2 false positive)",
    () => {
      expect(
        fired(
          '<style>.skip{opacity:0}.skip:focus{opacity:1}</style><a href="#main" class="skip">Skip</a><button>Real</button>',
        ),
      ).not.toContain("hidden-while-focusable");
    },
  );
  test.fails(
    "04 overflow:hidden carousel item should pass (CI-3 false positive)",
    () => {
      expect(
        fired(
          '<div style="width:200px;height:60px;overflow:hidden;white-space:nowrap;position:relative"><a href="#a" style="display:inline-block;width:200px">Item 1</a><a href="#b" style="display:inline-block;width:200px;margin-left:400px">Item 2</a></div>',
        ),
      ).not.toContain("hidden-while-focusable");
    },
  );
  test("05 overflow:auto carousel item passes (correct handling, contrast to CI-3)", () => {
    expect(
      fired(
        '<div style="width:200px;height:60px;overflow:auto;white-space:nowrap;position:relative"><a href="#a" style="display:inline-block;width:200px">Item 1</a><a href="#b" style="display:inline-block;width:200px;margin-left:400px">Item 2</a></div>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("06 opacity:0 ancestor never revealed is correctly flagged (true positive)", () => {
    expect(
      fired(
        '<div style="opacity:0"><button>Hidden</button></div><button>Real</button>',
      ),
    ).toContain("hidden-while-focusable");
  });
  test("07 left:-9999px with no focus reveal is correctly flagged (true positive)", () => {
    expect(
      fired(
        '<a href="#x" style="position:absolute;left:-9999px">Lost link</a><button>Real</button>',
      ),
    ).toContain("hidden-while-focusable");
  });
  test("08 transform:scale(0) control is correctly flagged (true positive, zero-size)", () => {
    expect(
      fired(
        '<button style="transform:scale(0)">Scaled away</button><button>Real</button>',
      ),
    ).toContain("hidden-while-focusable");
  });
  test.fails(
    "09 filter:opacity(0) control should be flagged (CI-4 false negative)",
    () => {
      expect(
        fired(
          '<button style="filter:opacity(0)">Ghost</button><button>Real</button>',
        ),
      ).toContain("hidden-while-focusable");
    },
  );
  test.fails(
    "10 clip:rect(0 0 0 0) on a normal-size control should be flagged (CI-5 false negative)",
    () => {
      expect(
        fired(
          '<button style="position:absolute;top:40px;left:40px;clip:rect(0,0,0,0)">Ghost</button><button>Real</button>',
        ),
      ).toContain("hidden-while-focusable");
    },
  );
});

describe("clickable-not-focusable", () => {
  // cited source is the right authority
  test("01 card wrapper around a focusable link passes", () => {
    expect(
      fired(
        '<div onclick="location.href=\'/a\'" style="cursor:pointer"><a href="/a">Read article</a></div>',
      ),
    ).not.toContain("clickable-not-focusable");
  });
  test("02 native button with onclick is not flagged", () => {
    expect(fired('<button onclick="save()">Save</button>')).not.toContain(
      "clickable-not-focusable",
    );
  });
  test("03 roving toolbar item (role=button tabindex=-1) passes", () => {
    expect(
      fired(
        '<div role="toolbar" aria-label="Format"><div role="button" tabindex="0">Bold</div><div role="button" tabindex="-1" onclick="italic()">Italic</div></div>',
      ),
    ).not.toContain("clickable-not-focusable");
  });
  test("04 aria-activedescendant managed child passes", () => {
    expect(
      fired(
        '<div role="application" tabindex="0" aria-activedescendant="o1" style="min-height:20px"><div role="button" id="o1" onclick="pick()">One</div></div>',
      ),
    ).not.toContain("clickable-not-focusable");
  });
  test("05 zero-size clickable is not flagged", () => {
    expect(
      fired(
        '<div role="button" onclick="x()" style="width:0;height:0;overflow:hidden">x</div>',
      ),
    ).not.toContain("clickable-not-focusable");
  });
  test("06 div role=button mouse-only fails", () => {
    expect(fired('<div role="button" onclick="save()">Save</div>')).toContain(
      "clickable-not-focusable",
    );
  });
  test("07 onclick div without a role fails", () => {
    expect(
      fired('<div onclick="save()" style="cursor:pointer">Save</div>'),
    ).toContain("clickable-not-focusable");
  });
  test("08 non-focusable badge inside a focusable card fails", () => {
    expect(
      fired(
        '<div onclick="open()"><a href="/a">Title</a><span role="button" onclick="quick()">Quick</span></div>',
      ),
    ).toContain("clickable-not-focusable");
  });
  test("09 svg role=button mouse-only fails", () => {
    expect(
      fired(
        '<svg role="button" onclick="x()" width="24" height="24"><rect width="24" height="24"></rect></svg>',
      ),
    ).toContain("clickable-not-focusable");
  });
  test.fails(
    "10 BUG href-less fake link should fail (currently passes - false negative)",
    () => {
      expect(fired('<a onclick="save()">Save</a>')).toContain(
        "clickable-not-focusable",
      );
    },
  );
  test.fails(
    "11 BUG standalone role=button tabindex=-1 should fail (currently passes - false negative)",
    () => {
      expect(
        fired('<div role="button" tabindex="-1" onclick="save()">Save</div>'),
      ).toContain("clickable-not-focusable");
    },
  );
  test.fails(
    "12 EDGE aria-disabled clickable - arguably should pass (currently fails - false positive)",
    () => {
      expect(
        fired(
          '<div role="button" aria-disabled="true" onclick="save()">Save</div>',
        ),
      ).not.toContain("clickable-not-focusable");
    },
  );
});

describe("composite-roving-tabindex", () => {
  // cited source is arguably mismatched (audit suggests: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
  test("01 valid: radiogroup with roving tabindex (one 0, rest -1) passes", () => {
    expect(
      fired(
        '<div role="radiogroup" aria-label="Align"><div role="radio" tabindex="0" aria-checked="true">Left</div><div role="radio" tabindex="-1" aria-checked="false">Right</div></div>',
      ),
    ).not.toContain("composite-roving-tabindex");
  });
  test("02 valid: aria-activedescendant listbox (options not tabbable) passes", () => {
    expect(
      fired(
        '<div role="listbox" tabindex="0" aria-label="Fruit" aria-activedescendant="o1"><div role="option" id="o1" aria-selected="true">Apple</div><div role="option" id="o2">Pear</div></div>',
      ),
    ).not.toContain("composite-roving-tabindex");
  });
  test("03 valid: native radio group with a default checked option passes", () => {
    expect(
      fired(
        '<div role="radiogroup" aria-label="Plan"><label><input type="radio" name="plan" checked> Basic</label><label><input type="radio" name="plan"> Pro</label></div>',
      ),
    ).not.toContain("composite-roving-tabindex");
  });
  test("04 valid: two separate toolbars are each a single stop", () => {
    expect(
      fired(
        '<div role="toolbar" aria-label="t1"><button tabindex="0">A</button><button tabindex="-1">B</button></div><div role="toolbar" aria-label="t2"><button tabindex="0">C</button><button tabindex="-1">D</button></div>',
      ),
    ).not.toContain("composite-roving-tabindex");
  });
  test("05 valid: role=group with two checkboxes is not a composite", () => {
    expect(
      fired(
        '<div role="group" aria-label="Options"><input type="checkbox" aria-label="a"><input type="checkbox" aria-label="b"></div>',
      ),
    ).not.toContain("composite-roving-tabindex");
  });
  test.fails(
    "06 FALSE POSITIVE: native radio group with no default selection (should pass, currently fails)",
    () => {
      expect(
        fired(
          '<div role="radiogroup" aria-label="Plan"><label><input type="radio" name="plan"> Basic</label><label><input type="radio" name="plan"> Pro</label></div>',
        ),
      ).not.toContain("composite-roving-tabindex");
    },
  );
  test("07 invalid: ARIA radios all tabindex=0 (no roving) fails", () => {
    expect(
      fired(
        '<div role="radiogroup" aria-label="Align"><div role="radio" tabindex="0" aria-checked="true">Left</div><div role="radio" tabindex="0" aria-checked="false">Right</div></div>',
      ),
    ).toContain("composite-roving-tabindex");
  });
  test("08 invalid: tablist of native role=tab buttons (each tabbable) fails", () => {
    expect(
      fired(
        '<div role="tablist" aria-label="Sections"><button role="tab" aria-selected="true">One</button><button role="tab" aria-selected="false">Two</button></div>',
      ),
    ).toContain("composite-roving-tabindex");
  });
  test("09 invalid: menubar with two tabindex=0 menuitems fails", () => {
    expect(
      fired(
        '<div role="menubar" aria-label="Main"><div role="menuitem" tabindex="0">File</div><div role="menuitem" tabindex="0">Edit</div></div>',
      ),
    ).toContain("composite-roving-tabindex");
  });
  test("10 invalid: grid with two tabindex=0 cells fails", () => {
    expect(
      fired(
        '<div role="grid" aria-label="Data"><div role="row"><div role="gridcell" tabindex="0">A</div></div><div role="row"><div role="gridcell" tabindex="0">B</div></div></div>',
      ),
    ).toContain("composite-roving-tabindex");
  });
  test.fails(
    "11 FALSE NEGATIVE: treegrid with two tabbable cells (should fail, currently passes)",
    () => {
      expect(
        fired(
          '<div role="treegrid" aria-label="Files"><div role="row"><div role="gridcell" tabindex="0">A</div></div><div role="row"><div role="gridcell" tabindex="0">B</div></div></div>',
        ),
      ).toContain("composite-roving-tabindex");
    },
  );
  test("12 invalid: nested toolbar + radiogroup, all stops loose (message undercount)", () => {
    expect(
      fired(
        '<div role="toolbar" aria-label="Format"><button tabindex="0">A</button><button tabindex="0">B</button><div role="radiogroup" aria-label="Align"><div role="radio" tabindex="0">X</div><div role="radio" tabindex="0">Y</div></div></div>',
      ),
    ).toContain("composite-roving-tabindex");
  });
  test("13 invalid (defensible): toolbar with textbox as a separate tab stop", () => {
    expect(
      fired(
        '<div role="toolbar" aria-label="Format"><button tabindex="0">Bold</button><input type="text" tabindex="0" aria-label="Font size"></div>',
      ),
    ).toContain("composite-roving-tabindex");
  });
});

describe("focus-escapes-modal", () => {
  // cited source is the right authority (audit suggests: https://www.w3.org/TR/wai-aria-1.2/#aria-modal)
  test("01 valid: modal with only its own controls", () => {
    expect(
      fired(
        '<div role="dialog" aria-modal="true"><button>OK</button><button>Cancel</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test("02 valid: background made inert while aria-modal open", () => {
    expect(
      fired(
        '<div inert><button>Home</button><button>Settings</button></div><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test("03 valid: background removed from tab order via tabindex=-1 (rule's own advice)", () => {
    expect(
      fired(
        '<div aria-hidden="true"><button tabindex="-1">Home</button></div><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test("04 valid: non-modal <dialog open> keeps background interactive", () => {
    expect(
      fired(
        "<button>Background</button><dialog open><button>Inside</button></dialog>",
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test('05 valid: aria-modal="false" is not a modal', () => {
    expect(
      fired(
        '<button>Background</button><div role="dialog" aria-modal="false"><button>Inside</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test("06 valid: no modal present at all", () => {
    expect(fired('<button>One</button><a href="#x">Two</a>')).not.toContain(
      "focus-escapes-modal",
    );
  });
  test("07 invalid: aria-modal with tabbable background (genuine leak, no inert/trap)", () => {
    expect(
      fired(
        '<button>Background</button><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).toContain("focus-escapes-modal");
  });
  test("08 invalid: aria-hidden-only background is still tabbable", () => {
    expect(
      fired(
        '<div aria-hidden="true"><button>Background</button></div><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).toContain("focus-escapes-modal");
  });
  test("09 invalid: many background controls collapse into one finding", () => {
    expect(
      fired(
        '<button>BgOne</button><button>BgTwo</button><a href="#x">BgLink</a><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).toContain("focus-escapes-modal");
  });
  test.fails(
    "10 edge/KNOWN-BUG: correctly-built stacked modals (A inert background, B active)",
    () => {
      expect(
        fired(
          '<div role="dialog" aria-modal="true" inert><button>A action</button></div><div role="dialog" aria-modal="true"><button>B action</button></div>',
        ),
      ).not.toContain("focus-escapes-modal");
    },
  );
  test('11 edge: role="alertdialog" modal with tabbable background', () => {
    expect(
      fired(
        '<button>Background</button><div role="alertdialog" aria-modal="true"><button>Confirm</button></div>',
      ),
    ).toContain("focus-escapes-modal");
  });
});

describe("tabindex-on-noninteractive", () => {
  // cited source is the right authority (audit suggests: https://www.w3.org/TR/wai-aria-1.2/#presentation_role_conflict_resolution (precise normative hook for the role=presentation/none false negative); plus the same APG page's 'Keyboard Navigation Between Components (The Tab Sequence)' section for the general principle)
  test("01 plain div with tabindex=0 is flagged", () => {
    expect(
      fired('<div tabindex="0">Just some decorative text</div>'),
    ).toContain("tabindex-on-noninteractive");
  });
  test("02 heading used as skip-link target with tabindex=0 is flagged (should be -1)", () => {
    expect(fired('<h1 tabindex="0">Welcome</h1>')).toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("03 button with explicit tabindex=0 passes", () => {
    expect(fired('<button tabindex="0">Save</button>')).not.toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("04 keyboard-scrollable container with tabindex=0 passes", () => {
    expect(
      fired(
        '<div tabindex="0" style="overflow:auto;width:60px;height:30px">a b c d e f g h i</div>',
      ),
    ).not.toContain("tabindex-on-noninteractive");
  });
  test("05 contenteditable element with tabindex=0 passes", () => {
    expect(
      fired('<div contenteditable="true" tabindex="0">Edit me</div>'),
    ).not.toContain("tabindex-on-noninteractive");
  });
  test("06 div with role=button and tabindex=0 passes", () => {
    expect(fired('<div role="button" tabindex="0">Toggle</div>')).not.toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("07 role=tabpanel with tabindex=0 (no focusable children) passes", () => {
    expect(
      fired('<div role="tabpanel" tabindex="0">Panel body text</div>'),
    ).not.toContain("tabindex-on-noninteractive");
  });
  test("08 role=presentation with tabindex=0 is flagged", () => {
    expect(
      fired('<div role="presentation" tabindex="0">Decorative</div>'),
    ).toContain("tabindex-on-noninteractive");
  });
  test("08b role=none with tabindex=0 is flagged", () => {
    expect(
      fired('<div role="none" tabindex="0">Decorative</div>'),
    ).toContain("tabindex-on-noninteractive");
  });
  test.fails(
    "09 unknown/invalid role with tabindex=0 should be flagged",
    () => {
      expect(fired('<div role="zzz" tabindex="0">Bogus role</div>')).toContain(
        "tabindex-on-noninteractive",
      );
    },
  );
  test.fails("10 role=note with tabindex=0 should be flagged", () => {
    expect(fired('<div role="note" tabindex="0">A side note</div>')).toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("11 iframe with tabindex=0 should not be flagged", () => {
    expect(
      fired(
        '<iframe tabindex="0" title="Embedded report" style="width:200px;height:120px"></iframe>',
      ),
    ).not.toContain("tabindex-on-noninteractive");
  });
  test("12 video[controls] with tabindex=0 should not be flagged", () => {
    expect(
      fired(
        '<video controls tabindex="0" style="width:120px;height:80px"></video>',
      ),
    ).not.toContain("tabindex-on-noninteractive");
  });
  test.fails(
    "13 undefined custom element with tabindex=0 should not be flagged",
    () => {
      expect(fired('<my-widget tabindex="0">Widget</my-widget>')).not.toContain(
        "tabindex-on-noninteractive",
      );
    },
  );
});

describe("prefer-native-element", () => {
  test("01 passes: a real <button>", () => {
    expect(fired("<button>Go</button>")).not.toContain("prefer-native-element");
  });
  test("02 passes: redundant role on a native control (nothing to swap)", () => {
    expect(fired('<button role="button">Go</button>')).not.toContain(
      "prefer-native-element",
    );
  });
  test('03 flags <div role="button" tabindex="0">', () => {
    expect(fired('<div role="button" tabindex="0">Go</div>')).toContain(
      "prefer-native-element",
    );
  });
  test('04 flags <span role="link" tabindex="0">', () => {
    expect(fired('<span role="link" tabindex="0">Open</span>')).toContain(
      "prefer-native-element",
    );
  });
  test('05 flags <div role="checkbox" tabindex="0">', () => {
    expect(fired('<div role="checkbox" tabindex="0">Agree</div>')).toContain(
      "prefer-native-element",
    );
  });
  test("06 passes: roles with no native equivalent (menuitem)", () => {
    expect(fired('<div role="menuitem" tabindex="0">Cut</div>')).not.toContain(
      "prefer-native-element",
    );
  });
  test("07 passes: a role-less tabindex box (that's tabindex-on-noninteractive)", () => {
    expect(fired('<div tabindex="0">Region</div>')).not.toContain(
      "prefer-native-element",
    );
  });
});

describe("duplicate-autofocus", () => {
  test("01 passes: no autofocus", () => {
    expect(fired("<input><input>")).not.toContain("duplicate-autofocus");
  });
  test("02 passes: a single autofocus", () => {
    expect(fired("<input autofocus><input>")).not.toContain(
      "duplicate-autofocus",
    );
  });
  test("03 flags two autofocus elements", () => {
    expect(fired("<input autofocus><input autofocus>")).toContain(
      "duplicate-autofocus",
    );
  });
  test("04 reports one finding per extra (two extras → two findings)", () => {
    document.body.innerHTML =
      "<input autofocus><input autofocus><input autofocus>";
    const dupes = audit(document.body).violations.filter(
      (v) => v.rule === "duplicate-autofocus",
    );
    expect(dupes).toHaveLength(2);
  });
  test("05 counts focusable-but-not-tabbable (tabindex=-1) autofocus", () => {
    // The div isn't a tab stop, but it IS focusable, so the browser focuses it on
    // load; the input is then the ignored duplicate.
    expect(
      fired('<div tabindex="-1" autofocus>x</div><input autofocus>'),
    ).toContain("duplicate-autofocus");
  });
  test("06 winner is first in document order; the later one is flagged", () => {
    document.body.innerHTML =
      '<div tabindex="-1" autofocus>x</div><input autofocus>';
    const dupes = audit(document.body).violations.filter(
      (v) => v.rule === "duplicate-autofocus",
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.element.tagName).toBe("INPUT");
  });
  test("07 a non-focusable autofocus doesn't count as a duplicate", () => {
    // The bare div can't be focused, so the single input is the only real
    // autofocus — no duplicate.
    expect(fired("<div autofocus>x</div><input autofocus>")).not.toContain(
      "duplicate-autofocus",
    );
  });
});

describe("autofocus-not-focusable", () => {
  test("01 passes: autofocus on a focusable control", () => {
    expect(fired("<input autofocus>")).not.toContain("autofocus-not-focusable");
  });
  test("02 passes: autofocus on a tabindex=-1 (focusable) element", () => {
    expect(fired('<div tabindex="-1" autofocus>x</div>')).not.toContain(
      "autofocus-not-focusable",
    );
  });
  test("03 flags autofocus on a bare, non-focusable element", () => {
    expect(fired("<div autofocus>x</div>")).toContain(
      "autofocus-not-focusable",
    );
  });
});

describe("nested-interactive", () => {
  test("01 passes: sibling controls, no nesting", () => {
    expect(fired('<button>A</button><a href="#">B</a>')).not.toContain(
      "nested-interactive",
    );
  });
  test("02 passes: a <label> wrapping an input is not a focusable ancestor", () => {
    expect(fired("<label>Name <input></label>")).not.toContain(
      "nested-interactive",
    );
  });
  test("03 passes: a plain (non-focusable) wrapper around a control", () => {
    expect(fired("<div><button>A</button></div>")).not.toContain(
      "nested-interactive",
    );
  });
  test("04 flags a <button> inside an <a href>", () => {
    expect(fired('<a href="#"><button>Buy</button></a>')).toContain(
      "nested-interactive",
    );
  });
  test('05 flags a control inside a tabindex="0" wrapper', () => {
    expect(fired('<div tabindex="0"><button>Go</button></div>')).toContain(
      "nested-interactive",
    );
  });
  test("06 flags the inner control, not the outer wrapper", () => {
    document.body.innerHTML = '<a href="#"><button>Buy</button></a>';
    const nested = audit(document.body).violations.filter(
      (v) => v.rule === "nested-interactive",
    );
    expect(nested).toHaveLength(1);
    expect(nested[0]!.element.tagName).toBe("BUTTON");
  });
  test('07 passes: a tabindex="-1" focus-target wrapper is not a tab stop', () => {
    expect(
      fired('<div tabindex="-1"><button>Close</button></div>'),
    ).not.toContain("nested-interactive");
  });
});

describe("redundant-tabindex", () => {
  test("01 passes: a native control with no tabindex", () => {
    expect(fired("<button>Save</button>")).not.toContain("redundant-tabindex");
  });
  test('02 flags <button tabindex="0">', () => {
    expect(fired('<button tabindex="0">Save</button>')).toContain(
      "redundant-tabindex",
    );
  });
  test('03 flags <a href> with tabindex="0"', () => {
    expect(fired('<a href="#x" tabindex="0">Home</a>')).toContain(
      "redundant-tabindex",
    );
  });
  test('04 flags <input> with tabindex="0"', () => {
    expect(fired('<input tabindex="0">')).toContain("redundant-tabindex");
  });
  test('05 flags <select> and <textarea> with tabindex="0"', () => {
    expect(fired('<select tabindex="0"><option>A</option></select>')).toContain(
      "redundant-tabindex",
    );
    expect(fired('<textarea tabindex="0"></textarea>')).toContain(
      "redundant-tabindex",
    );
  });
  test('06 passes: href-less <a> needs tabindex="0" to be focusable', () => {
    expect(fired('<a tabindex="0">Fake link</a>')).not.toContain(
      "redundant-tabindex",
    );
  });
  test('07 passes: <div role="button" tabindex="0"> is not natively focusable', () => {
    expect(fired('<div role="button" tabindex="0">Go</div>')).not.toContain(
      "redundant-tabindex",
    );
  });
  test('08 passes: tabindex="-1" removes from the sequence, not redundant', () => {
    expect(
      fired('<button>A</button><button tabindex="-1">B</button>'),
    ).not.toContain("redundant-tabindex");
  });
  test("09 passes: positive tabindex is no-positive-tabindex, not redundant", () => {
    expect(fired('<button tabindex="1">Save</button>')).not.toContain(
      "redundant-tabindex",
    );
  });
  test('10 passes: plain div with tabindex="0" (that\'s tabindex-on-noninteractive)', () => {
    expect(fired('<div tabindex="0">Region</div>')).not.toContain(
      "redundant-tabindex",
    );
  });
  test("11 flags the element itself, not a sibling", () => {
    document.body.innerHTML = '<input tabindex="0"><button>Save</button>';
    const redundant = audit(document.body).violations.filter(
      (v) => v.rule === "redundant-tabindex",
    );
    expect(redundant).toHaveLength(1);
    expect(redundant[0]!.element.tagName).toBe("INPUT");
  });
});
