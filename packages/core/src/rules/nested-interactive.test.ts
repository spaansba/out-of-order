import { afterEach, describe, expect, test } from "vitest";
import { audit } from "../index.js";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("nested-interactive", () => {
  test("01 passes: sibling controls, no nesting", () => {
    expect(fired('<button>A</button><a href="#">B</a>')).not.toContain("nested-interactive");
  });
  test("02 passes: a <label> wrapping an input is not a focusable ancestor", () => {
    expect(fired("<label>Name <input></label>")).not.toContain("nested-interactive");
  });
  test("03 passes: a plain (non-focusable) wrapper around a control", () => {
    expect(fired("<div><button>A</button></div>")).not.toContain("nested-interactive");
  });
  test("04 flags a <button> inside an <a href>", () => {
    expect(fired('<a href="#"><button>Buy</button></a>')).toContain("nested-interactive");
  });
  test('05 flags a control inside a tabindex="0" wrapper', () => {
    expect(fired('<div tabindex="0"><button>Go</button></div>')).toContain("nested-interactive");
  });
  test("06 flags the inner control, not the outer wrapper", () => {
    document.body.innerHTML = '<a href="#"><button>Buy</button></a>';
    const nested = audit(document.body).violations.filter((v) =>
      v.issues.some((i) => i.rule === "nested-interactive"),
    );
    expect(nested).toHaveLength(1);
    expect(nested[0]!.element.tagName).toBe("BUTTON");
  });
  test('07 passes: a tabindex="-1" focus-target wrapper is not a tab stop', () => {
    expect(fired('<div tabindex="-1"><button>Close</button></div>')).not.toContain(
      "nested-interactive",
    );
  });
});
