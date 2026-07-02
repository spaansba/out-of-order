import { afterEach, describe, expect, test } from "vitest";
import { audit } from "../index.js";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("duplicate-autofocus", () => {
  test("01 passes: no autofocus", () => {
    expect(fired("<input><input>")).not.toContain("duplicate-autofocus");
  });
  test("02 passes: a single autofocus", () => {
    expect(fired("<input autofocus><input>")).not.toContain("duplicate-autofocus");
  });
  test("03 flags two autofocus elements", () => {
    expect(fired("<input autofocus><input autofocus>")).toContain("duplicate-autofocus");
  });
  test("04 reports one finding per extra (two extras → two findings)", () => {
    document.body.innerHTML = "<input autofocus><input autofocus><input autofocus>";
    const dupes = audit(document.body).violations.filter((v) =>
      v.issues.some((i) => i.rule === "duplicate-autofocus"),
    );
    expect(dupes).toHaveLength(2);
  });
  test("05 counts focusable-but-not-tabbable (tabindex=-1) autofocus", () => {
    // The div isn't a tab stop, but it IS focusable, so the browser focuses it on
    // load; the input is then the ignored duplicate.
    expect(fired('<div tabindex="-1" autofocus>x</div><input autofocus>')).toContain(
      "duplicate-autofocus",
    );
  });
  test("06 winner is first in document order; the later one is flagged", () => {
    document.body.innerHTML = '<div tabindex="-1" autofocus>x</div><input autofocus>';
    const dupes = audit(document.body).violations.filter((v) =>
      v.issues.some((i) => i.rule === "duplicate-autofocus"),
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.element.tagName).toBe("INPUT");
  });
  test("07 a non-focusable autofocus doesn't count as a duplicate", () => {
    // The bare div can't be focused, so the single input is the only real
    // autofocus — no duplicate.
    expect(fired("<div autofocus>x</div><input autofocus>")).not.toContain("duplicate-autofocus");
  });
});
