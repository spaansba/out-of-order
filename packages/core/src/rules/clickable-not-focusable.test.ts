import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("clickable-not-focusable", () => {
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
      fired('<div role="button" onclick="x()" style="width:0;height:0;overflow:hidden">x</div>'),
    ).not.toContain("clickable-not-focusable");
  });
  test("05b visibility:hidden clickable is not flagged", () => {
    expect(
      fired('<div role="button" onclick="x()" style="visibility:hidden">Save</div>'),
    ).not.toContain("clickable-not-focusable");
  });
  test("06 div role=button mouse-only fails", () => {
    expect(fired('<div role="button" onclick="save()">Save</div>')).toContain(
      "clickable-not-focusable",
    );
  });
  test("07 onclick div without a role fails", () => {
    expect(fired('<div onclick="save()" style="cursor:pointer">Save</div>')).toContain(
      "clickable-not-focusable",
    );
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
  test("10 href-less fake link fails", () => {
    expect(fired('<a onclick="save()">Save</a>')).toContain("clickable-not-focusable");
  });
  test("10b href-less link without handlers passes", () => {
    expect(fired("<a>Save</a>")).not.toContain("clickable-not-focusable");
  });
  test("11 standalone role=button tabindex=-1 fails", () => {
    expect(fired('<div role="button" tabindex="-1" onclick="save()">Save</div>')).toContain(
      "clickable-not-focusable",
    );
  });
  test("12 aria-disabled clickable is not flagged", () => {
    expect(
      fired('<div role="button" aria-disabled="true" onclick="save()">Save</div>'),
    ).not.toContain("clickable-not-focusable");
  });
  test("12b aria-disabled=false clickable still fails", () => {
    expect(fired('<div role="button" aria-disabled="false" onclick="save()">Save</div>')).toContain(
      "clickable-not-focusable",
    );
  });
});
