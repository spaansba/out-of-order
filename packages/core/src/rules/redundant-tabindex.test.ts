import { afterEach, describe, expect, test } from "vitest";
import { audit } from "../index.js";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("redundant-tabindex", () => {
  test("01 passes: a native control with no tabindex", () => {
    expect(fired("<button>Save</button>")).not.toContain("redundant-tabindex");
  });
  test('02 flags <button tabindex="0">', () => {
    expect(fired('<button tabindex="0">Save</button>')).toContain("redundant-tabindex");
  });
  test('03 flags <a href> with tabindex="0"', () => {
    expect(fired('<a href="#x" tabindex="0">Home</a>')).toContain("redundant-tabindex");
  });
  test('04 flags <input> with tabindex="0"', () => {
    expect(fired('<input tabindex="0">')).toContain("redundant-tabindex");
  });
  test('05 flags <select> and <textarea> with tabindex="0"', () => {
    expect(fired('<select tabindex="0"><option>A</option></select>')).toContain(
      "redundant-tabindex",
    );
    expect(fired('<textarea tabindex="0"></textarea>')).toContain("redundant-tabindex");
  });
  test('06 passes: href-less <a> needs tabindex="0" to be focusable', () => {
    expect(fired('<a tabindex="0">Fake link</a>')).not.toContain("redundant-tabindex");
  });
  test('07 passes: <div role="button" tabindex="0"> is not natively focusable', () => {
    expect(fired('<div role="button" tabindex="0">Go</div>')).not.toContain("redundant-tabindex");
  });
  test('08 passes: tabindex="-1" removes from the sequence, not redundant', () => {
    expect(fired('<button>A</button><button tabindex="-1">B</button>')).not.toContain(
      "redundant-tabindex",
    );
  });
  test("09 passes: positive tabindex is no-positive-tabindex, not redundant", () => {
    expect(fired('<button tabindex="1">Save</button>')).not.toContain("redundant-tabindex");
  });
  test('10 passes: plain div with tabindex="0" (that\'s tabindex-on-noninteractive)', () => {
    expect(fired('<div tabindex="0">Region</div>')).not.toContain("redundant-tabindex");
  });
  test("11 flags the element itself, not a sibling", () => {
    document.body.innerHTML = '<input tabindex="0"><button>Save</button>';
    const redundant = audit(document.body).violations.filter((v) =>
      v.issues.some((i) => i.rule === "redundant-tabindex"),
    );
    expect(redundant).toHaveLength(1);
    expect(redundant[0]!.element.tagName).toBe("INPUT");
  });
});
