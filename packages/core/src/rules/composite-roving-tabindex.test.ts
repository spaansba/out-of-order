import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("composite-roving-tabindex", () => {
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
  test("06 valid: native radio group with no default selection passes", () => {
    expect(
      fired(
        '<div role="radiogroup" aria-label="Plan"><label><input type="radio" name="plan"> Basic</label><label><input type="radio" name="plan"> Pro</label></div>',
      ),
    ).not.toContain("composite-roving-tabindex");
  });
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
  test("11 invalid: treegrid with two tabbable cells", () => {
    expect(
      fired(
        '<div role="treegrid" aria-label="Files"><div role="row"><div role="gridcell" tabindex="0">A</div></div><div role="row"><div role="gridcell" tabindex="0">B</div></div></div>',
      ),
    ).toContain("composite-roving-tabindex");
  });
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
