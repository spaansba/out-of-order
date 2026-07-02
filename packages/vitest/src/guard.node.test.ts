import { describe, expect, test } from "vitest";

import "@out-of-order/vitest";

describe("real-browser guard (node)", () => {
  test("throws when no DOM exists at all", () => {
    expect(() => expect(undefined).toHaveValidTabOrder()).toThrow(/no DOM at all/);
  });
});
