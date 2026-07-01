import { expect } from "vitest";
import { audit, type AuditOptions, type AuditResult } from "@out-of-order/core";

function assertRealBrowser(): void {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (typeof window === "undefined" || userAgent.includes("jsdom")) {
    throw new Error(
      "toHaveValidTabOrder() needs a real browser and found jsdom. Enable Vitest " +
        "Browser Mode (test.browser.enabled) for these tests. jsdom has no layout " +
        "engine, so tab order and visibility cannot be measured.",
    );
  }
}

/** Accept an Element or a Document/DocumentFragment as the assertion target. */
function resolveRoot(received: unknown): ParentNode {
  if (
    received instanceof Element ||
    received instanceof Document ||
    received instanceof DocumentFragment
  ) {
    return received;
  }
  throw new Error(
    `toHaveValidTabOrder() expects an Element, Document, or DocumentFragment, received: ${String(
      received,
    )}`,
  );
}

expect.extend({
  toHaveValidTabOrder(received: unknown, options?: AuditOptions) {
    assertRealBrowser();
    const root = resolveRoot(received);
    const result: AuditResult = audit(root, options);
    const { isNot } = this;

    const issueCount = result.violations.reduce(
      (total, violation) => total + violation.issues.length,
      0,
    );

    return {
      pass: result.valid,
      actual: result.violations,
      message: () =>
        isNot
          ? `Expected tab order to be invalid, but no violations were found ` +
            `(${result.sequence.length} focusable elements checked).`
          : `Expected a valid tab order, found ${issueCount} issue(s):\n` +
            audit(root, { ...options, format: "text" }).violations,
    };
  },
});

interface TabOrderMatchers<Ret = unknown> {
  /**
   * Assert the focusable elements within the target form a valid tab order. Must
   * run in a real browser (Vitest Browser Mode); the checks rely on CSS layout.
   */
  toHaveValidTabOrder(options?: AuditOptions): Ret;
}

declare module "vitest" {
  // eslint-disable-next-line id-length -- type param must match vitest's `Assertion<T>` for declaration merging
  interface Assertion<T = any> extends TabOrderMatchers<T> {}
  interface AsymmetricMatchersContaining extends TabOrderMatchers {}
}

export { audit };
export type { AuditOptions, AuditResult } from "@out-of-order/core";
