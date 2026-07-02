import { describe, expect, test } from "vitest";

import "@out-of-order/vitest";

// Runs under the real jsdom environment (which has no layout engine), so it
// proves the matcher refuses to produce a misleading result rather than silently
// auditing a layout-less DOM.
describe("real-browser guard (jsdom)", () => {
  test("throws instead of silently running under jsdom", () => {
    document.body.innerHTML = `<button aria-label="Only">Only</button>`;
    expect(() => expect(document.body).toHaveValidTabOrder()).toThrow(/jsdom/);
  });
});
