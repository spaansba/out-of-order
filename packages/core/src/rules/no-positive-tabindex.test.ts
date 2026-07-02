import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("no-positive-tabindex", () => {
  test("01 passes: plain controls with no tabindex", () => {
    expect(fired('<button>A</button><a href="#x">B</a>')).not.toContain("no-positive-tabindex");
  });
  test('02 passes: tabindex="0" is allowed', () => {
    expect(fired('<div tabindex="0">Region</div>')).not.toContain("no-positive-tabindex");
  });
  test('03 passes: tabindex="-1" is not in the sequence', () => {
    expect(fired('<button>A</button><span tabindex="-1">B</span>')).not.toContain(
      "no-positive-tabindex",
    );
  });
  test('04 fails: tabindex="1" hijacks the order', () => {
    expect(fired('<button>A</button><button tabindex="1">Jumped to front</button>')).toContain(
      "no-positive-tabindex",
    );
  });
  test("05 fails: fractional tabindex truncated to 2 by the browser", () => {
    expect(fired('<button>a</button><button tabindex="2.9">b</button>')).toContain(
      "no-positive-tabindex",
    );
  });
  test("06 passes: out-of-range tabindex is reset to 0", () => {
    expect(
      fired('<button>Save</button><button tabindex="99999999999">Cancel</button>'),
    ).not.toContain("no-positive-tabindex");
  });
  test('07 fails: tabindex="3px" parses to a positive 3', () => {
    expect(
      fired('<button>First</button><button tabindex="3px">Jumped to front</button>'),
    ).toContain("no-positive-tabindex");
  });
  test("08 flags a meaning-preserving positive-tabindex order (best-practice vs 2.4.3)", () => {
    expect(
      fired(
        '<button tabindex="1">First</button><button tabindex="2">Second</button><button tabindex="3">Third</button>',
      ),
    ).toContain("no-positive-tabindex");
  });
});
