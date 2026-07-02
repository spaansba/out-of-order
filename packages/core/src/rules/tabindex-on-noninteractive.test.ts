import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tabindex-on-noninteractive", () => {
  test("01 plain div with tabindex=0 is flagged", () => {
    expect(fired('<div tabindex="0">Just some decorative text</div>')).toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("02 heading used as skip-link target with tabindex=0 is flagged (should be -1)", () => {
    expect(fired('<h1 tabindex="0">Welcome</h1>')).toContain("tabindex-on-noninteractive");
  });
  test("03 button with explicit tabindex=0 passes", () => {
    expect(fired('<button tabindex="0">Save</button>')).not.toContain("tabindex-on-noninteractive");
  });
  test("04 keyboard-scrollable container with tabindex=0 passes", () => {
    expect(
      fired(
        '<div tabindex="0" style="overflow:auto;width:60px;height:30px">a b c d e f g h i</div>',
      ),
    ).not.toContain("tabindex-on-noninteractive");
  });
  test("05 contenteditable element with tabindex=0 passes", () => {
    expect(fired('<div contenteditable="true" tabindex="0">Edit me</div>')).not.toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("06 div with role=button and tabindex=0 passes", () => {
    expect(fired('<div role="button" tabindex="0">Toggle</div>')).not.toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("07 role=tabpanel with tabindex=0 (no focusable children) passes", () => {
    expect(fired('<div role="tabpanel" tabindex="0">Panel body text</div>')).not.toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("08 role=presentation with tabindex=0 is flagged", () => {
    expect(fired('<div role="presentation" tabindex="0">Decorative</div>')).toContain(
      "tabindex-on-noninteractive",
    );
  });
  test("08b role=none with tabindex=0 is flagged", () => {
    expect(fired('<div role="none" tabindex="0">Decorative</div>')).toContain(
      "tabindex-on-noninteractive",
    );
  });
  test.fails("09 unknown/invalid role with tabindex=0 should be flagged", () => {
    expect(fired('<div role="zzz" tabindex="0">Bogus role</div>')).toContain(
      "tabindex-on-noninteractive",
    );
  });
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
      fired('<video controls tabindex="0" style="width:120px;height:80px"></video>'),
    ).not.toContain("tabindex-on-noninteractive");
  });
  test.fails("13 undefined custom element with tabindex=0 should not be flagged", () => {
    expect(fired('<my-widget tabindex="0">Widget</my-widget>')).not.toContain(
      "tabindex-on-noninteractive",
    );
  });
});
