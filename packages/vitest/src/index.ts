import { expect } from "vitest";
import {
  audit,
  formatViolations,
  type AuditOptions,
  type AuditResult,
} from "@out-of-order/core";

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
    const root = resolveRoot(received);
    const result: AuditResult = audit(root, options);
    const { isNot } = this;

    return {
      pass: result.valid,
      actual: result.violations,
      message: () =>
        isNot
          ? `Expected tab order to be invalid, but no violations were found ` +
            `(${result.sequence.length} focusable elements checked).`
          : `Expected a valid tab order, found ${result.violations.length} violation(s):\n` +
            formatViolations(result.violations),
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
