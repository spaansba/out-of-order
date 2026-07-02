import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("prefer-native-element", () => {
  test("01 passes: a real <button>", () => {
    expect(fired("<button>Go</button>")).not.toContain("prefer-native-element");
  });
  test("02 passes: redundant role on a native control (nothing to swap)", () => {
    expect(fired('<button role="button">Go</button>')).not.toContain("prefer-native-element");
  });
  test('03 flags <div role="button" tabindex="0">', () => {
    expect(fired('<div role="button" tabindex="0">Go</div>')).toContain("prefer-native-element");
  });
  test('04 flags <span role="link" tabindex="0">', () => {
    expect(fired('<span role="link" tabindex="0">Open</span>')).toContain("prefer-native-element");
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
    expect(fired('<div tabindex="0">Region</div>')).not.toContain("prefer-native-element");
  });
});
