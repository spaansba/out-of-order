import { describe, expect, test } from "vitest";

import "@out-of-order/vitest";

// happy-dom's user agent never mentions jsdom, so this proves the guard detects
// the missing layout engine itself instead of sniffing user agents.
describe("real-browser guard (happy-dom)", () => {
  test("throws instead of silently running under happy-dom", () => {
    document.body.innerHTML = `<button aria-label="Only">Only</button>`;
    expect(() => expect(document.body).toHaveValidTabOrder()).toThrow(/happy-dom/);
  });
});
