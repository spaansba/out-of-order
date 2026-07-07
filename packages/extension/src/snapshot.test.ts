import { afterEach, expect, test } from "vitest";
import { audit, selectorFor } from "@out-of-order/core";
import { buildSnapshot, formatReport, pageViolations } from "./snapshot.js";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(html: string): void {
  document.body.innerHTML = html;
}

test("snapshot survives JSON serialization and index-aligns with live violations", () => {
  mount(`
    <button id="first">First</button>
    <div id="jumper" tabindex="5">Jumps the queue</div>
    <button id="last">Last</button>
  `);

  const result = audit(document);
  const violations = pageViolations(result);
  const snapshot = buildSnapshot(result, violations);

  expect(violations.length).toBeGreaterThan(0);
  expect(snapshot.violations.map((v) => v.selector)).toEqual(
    violations.map((v) => selectorFor(v.element)),
  );
  expect(snapshot.stopCount).toBe(3);
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
});

test("elements inside an embedded trace overlay are excluded", () => {
  mount(`
    <button>Fine</button>
    <div class="ooo-layer">
      <div tabindex="0">Overlay control</div>
    </div>
  `);

  const result = audit(document);
  const violations = pageViolations(result);
  const snapshot = buildSnapshot(result, violations);

  expect(violations).toHaveLength(0);
  expect(snapshot.violations).toHaveLength(0);
  expect(snapshot.stopCount).toBe(1);
});

test("reports are formatted on demand in every copy format", () => {
  mount(`
    <button>First</button>
    <div tabindex="5">Jumps the queue</div>
  `);

  const result = audit(document);
  const violations = pageViolations(result);

  expect(formatReport(result, violations, "text")).toContain("tabindex");
  for (const format of ["by-element", "by-violation", "flat"] as const) {
    const parsed: unknown = JSON.parse(formatReport(result, violations, format));
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as unknown[]).length).toBeGreaterThan(0);
  }
});
