import { afterEach, expect, test } from "vitest";
import { audit } from "@out-of-order/core";
import { buildSnapshot, pageViolations } from "./snapshot.js";

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
  expect(snapshot.violations.map((v) => v.selector)).toEqual(violations.map((v) => v.selector));
  expect(snapshot.stopCount).toBe(3);
  expect(snapshot.valid).toBe(result.valid);
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
