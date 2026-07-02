import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("dir");
});

describe("hidden-while-focusable", () => {
  test("01 sr-only clip skip link passes (exemption works)", () => {
    expect(
      fired(
        '<a href="#main" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap">Skip to content</a><button>Real</button>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("02 off-screen skip link revealed on focus should pass (CI-1 false positive)", () => {
    expect(
      fired(
        '<style>.skip{position:absolute;left:-9999px;top:auto}.skip:focus{left:8px;top:8px}</style><a href="#main" class="skip">Skip to content</a><button>Real</button>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("03 opacity:0 control revealed on focus should pass (CI-2 false positive)", () => {
    expect(
      fired(
        '<style>.skip{opacity:0}.skip:focus{opacity:1}</style><a href="#main" class="skip">Skip</a><button>Real</button>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("04 overflow:hidden carousel item should pass (CI-3 false positive)", () => {
    expect(
      fired(
        '<div style="width:200px;height:60px;overflow:hidden;white-space:nowrap;position:relative"><a href="#a" style="display:inline-block;width:200px">Item 1</a><a href="#b" style="display:inline-block;width:200px;margin-left:400px">Item 2</a></div>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("05 overflow:auto carousel item passes (correct handling, contrast to CI-3)", () => {
    expect(
      fired(
        '<div style="width:200px;height:60px;overflow:auto;white-space:nowrap;position:relative"><a href="#a" style="display:inline-block;width:200px">Item 1</a><a href="#b" style="display:inline-block;width:200px;margin-left:400px">Item 2</a></div>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("06 opacity:0 ancestor never revealed is correctly flagged (true positive)", () => {
    expect(
      fired('<div style="opacity:0"><button>Hidden</button></div><button>Real</button>'),
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
      fired('<button style="transform:scale(0)">Scaled away</button><button>Real</button>'),
    ).toContain("hidden-while-focusable");
  });
  test("09 filter:opacity(0) control is correctly flagged (CI-4)", () => {
    expect(
      fired('<button style="filter:opacity(0)">Ghost</button><button>Real</button>'),
    ).toContain("hidden-while-focusable");
  });
  test("10 clip:rect(0 0 0 0) on a normal-size control is correctly flagged (CI-5)", () => {
    expect(
      fired(
        '<button style="position:absolute;top:40px;left:40px;clip:rect(0,0,0,0)">Ghost</button><button>Real</button>',
      ),
    ).toContain("hidden-while-focusable");
  });
  test("11 CSS-nested &:focus-visible reveal passes (header-anchor pattern)", () => {
    expect(
      fired(
        '<style>.anchor{opacity:0;&:hover,&:focus-visible{opacity:1}}</style><a href="#x" class="anchor">#</a><button>Real</button>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("12 CSS-nested hover-only reveal is still flagged (true positive)", () => {
    expect(
      fired(
        '<style>.anchor{opacity:0;&:hover{opacity:1}}</style><a href="#x" class="anchor">#</a><button>Real</button>',
      ),
    ).toContain("hidden-while-focusable");
  });
  test("13 nested & resolves to the parent selector, not any element (true positive)", () => {
    expect(
      fired(
        '<style>.a{&:focus{opacity:1}}.b{opacity:0}</style><a href="#x" class="b">Ghost</a><button>Real</button>',
      ),
    ).toContain("hidden-while-focusable");
  });
  test("14 child nested under a :focus-within parent passes (implicit scoping)", () => {
    expect(
      fired(
        '<style>.child{opacity:0}.card:focus-within{.child{opacity:1}}</style><div class="card"><a href="#x" class="child">Act</a></div><button>Real</button>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("15 nested focus reveal inside a media query passes", () => {
    expect(
      fired(
        '<style>@media (min-width:1px){.skip{opacity:0;&:focus{opacity:1}}}</style><a href="#x" class="skip">Skip</a><button>Real</button>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
  test("16 RTL document: right:-9999px is correctly flagged (true positive)", () => {
    document.documentElement.dir = "rtl";
    expect(
      fired(
        '<a href="#x" style="position:absolute;right:-9999px">Lost link</a><button>Real</button>',
      ),
    ).toContain("hidden-while-focusable");
  });
  test("17 RTL document: left:-9999px is scrollable overflow, passes", () => {
    document.documentElement.dir = "rtl";
    expect(
      fired(
        '<a href="#x" style="position:absolute;left:-9999px">Far but reachable</a><button>Real</button>',
      ),
    ).not.toContain("hidden-while-focusable");
  });
});
