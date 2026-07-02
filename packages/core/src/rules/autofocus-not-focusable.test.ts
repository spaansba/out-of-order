import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("autofocus-not-focusable", () => {
  test("01 passes: autofocus on a focusable control", () => {
    expect(fired("<input autofocus>")).not.toContain("autofocus-not-focusable");
  });
  test("02 passes: autofocus on a tabindex=-1 (focusable) element", () => {
    expect(fired('<div tabindex="-1" autofocus>x</div>')).not.toContain("autofocus-not-focusable");
  });
  test("03 flags autofocus on a bare, non-focusable element", () => {
    expect(fired("<div autofocus>x</div>")).toContain("autofocus-not-focusable");
  });
});
