import { expect } from "vitest";
import {
  audit,
  formatViolations,
  flaggedEntries,
  type AuditOptions,
  type AuditResult,
} from "@out-of-order/core";

let layoutConfirmed = false;

// Probe layout instead of sniffing user agents: every simulated DOM (jsdom,
// happy-dom, whatever comes next) reports zero-size rects, real browsers never do.
function assertRealBrowser(): void {
  if (typeof document === "undefined") {
    throw new Error(
      "toHaveValidTabOrder() needs a real browser and found no DOM at all. Enable " +
        "Vitest Browser Mode (test.browser.enabled) for these tests.",
    );
  }
  if (layoutConfirmed) {
    return;
  }

  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;width:10px;height:10px;";
  document.documentElement.appendChild(probe);
  const hasLayout = probe.getBoundingClientRect().width > 0;
  probe.remove();

  if (!hasLayout) {
    throw new Error(
      "toHaveValidTabOrder() needs a real browser and found a DOM without a layout " +
        "engine (jsdom, happy-dom, or similar). Enable Vitest Browser Mode " +
        "(test.browser.enabled) for these tests. Without layout, tab order and " +
        "visibility cannot be measured.",
    );
  }
  layoutConfirmed = true;
}

/** Accept an Element or a Document as the assertion target. */
function resolveRoot(received: unknown): Document | Element {
  if (received instanceof Element || received instanceof Document) {
    return received;
  }
  throw new Error(
    `toHaveValidTabOrder() expects an Element or Document, received: ${String(received)}`,
  );
}

expect.extend({
  toHaveValidTabOrder(received: unknown, options?: AuditOptions) {
    assertRealBrowser();
    const root = resolveRoot(received);
    const result: AuditResult = audit(root, options);
    const { isNot } = this;

    const flagged = flaggedEntries(result);
    const active = flagged.flatMap((entry) => entry.issues.filter((issue) => !issue.ignored));
    const errorCount = active.filter((issue) => issue.severity === "error").length;
    const warningCount = active.length - errorCount;

    return {
      pass: result.valid,
      actual: flagged,
      message: () => {
        if (isNot) {
          return active.length > 0
            ? `Expected tab order to be invalid, but only warnings were found ` +
                `(warnings don't invalidate the order):\n${formatViolations(result, "text")}`
            : `Expected tab order to be invalid, but no violations were found ` +
                `(${result.sequence.length} focusable elements checked).`;
        }
        const counts =
          `${errorCount} error(s)` + (warningCount > 0 ? ` and ${warningCount} warning(s)` : "");
        return `Expected a valid tab order, found ${counts}:\n` + formatViolations(result, "text");
      },
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
