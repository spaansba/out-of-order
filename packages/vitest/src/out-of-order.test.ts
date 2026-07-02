import { afterEach, describe, expect, test } from "vitest";

// In real usage this import lives in setup.ts; tests here rely on that.
// (Re-importing is harmless; expect.extend is idempotent.)
import "@out-of-order/vitest";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("toHaveValidTabOrder", () => {
  test("passes for a simple, well-labelled, in-order form", () => {
    document.body.innerHTML = `
      <button>First</button>
      <a href="#next">Second</a>
      <input aria-label="Search" />
    `;
    expect(document.body).toHaveValidTabOrder();
  });

  test("fails when a positive tabindex is present", () => {
    document.body.innerHTML = `
      <button>One</button>
      <button tabindex="5">Jumped to front</button>
    `;
    expect(document.body).not.toHaveValidTabOrder();
  });

  test("fails when a focusable control has no accessible name", () => {
    document.body.innerHTML = `
      <button>Labelled</button>
      <input />
    `;
    expect(document.body).not.toHaveValidTabOrder();
  });

  test("can disable a rule via options", () => {
    document.body.innerHTML = `<input />`;
    // Only the accessible-name rule would fire; turn it off.
    expect(document.body).toHaveValidTabOrder({
      rules: { "missing-accessible-name": "off" },
    });
  });

  test("failure message counts errors and lists each violation", () => {
    document.body.innerHTML = `
      <button>One</button>
      <button tabindex="5">Jumped to front</button>
    `;
    expect(() => expect(document.body).toHaveValidTabOrder()).toThrow(
      /found 1 error\(s\)[\s\S]*no-positive-tabindex/,
    );
  });

  test(".not failure message reports warnings instead of claiming a clean audit", () => {
    // visual-order-mismatch stays at its default "warning" severity, so the order
    // is valid and .not fails, but the audit is not clean.
    document.body.innerHTML = `
      <div style="position:relative; height:120px;">
        <button aria-label="A" style="position:absolute; top:80px; left:0;">A</button>
        <button aria-label="B" style="position:absolute; top:0;    left:0;">B</button>
      </div>
    `;
    expect(() =>
      expect(document.body).not.toHaveValidTabOrder({
        rules: {
          "missing-accessible-name": "off",
          "no-positive-tabindex": "off",
        },
      }),
    ).toThrow(/only warnings were found[\s\S]*visual-order-mismatch/);
  });

  test("detects visual order not matching tab order", () => {
    // DOM order: A then B. Visually B is placed above A via absolute positioning,
    // so the reading order is B, A, a mismatch with the tab order A, B.
    document.body.innerHTML = `
      <div style="position:relative; height:120px;">
        <button aria-label="A" style="position:absolute; top:80px; left:0;">A</button>
        <button aria-label="B" style="position:absolute; top:0;    left:0;">B</button>
      </div>
    `;
    // visual-order-mismatch defaults to "warning", which doesn't make the order
    // invalid; promote it so .not.toHaveValidTabOrder() actually asserts detection.
    expect(document.body).not.toHaveValidTabOrder({
      rules: {
        "missing-accessible-name": "off",
        "no-positive-tabindex": "off",
        "visual-order-mismatch": "error",
      },
    });
  });
});
