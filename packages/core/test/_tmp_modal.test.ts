import { afterEach, expect, test } from "vitest";
import { analyzeTabOrder } from "../src/index.js";

afterEach(() => {
  document.body.innerHTML = "";
});

test("native dialog showModal still flags focus-escapes-modal (the bug)", () => {
  document.body.innerHTML =
    '<button id="bg">Background</button>' +
    '<dialog id="d"><button>Close</button></dialog>';
  const dialog = document.getElementById("d") as HTMLDialogElement;
  dialog.showModal();

  const result = analyzeTabOrder(document.body);
  const rules = result.violations.map((v) => v.rule);
  console.log("matches :modal?", dialog.matches(":modal"));
  console.log("FIRED:", rules);
  console.log("valid:", result.valid);

  // The browser natively traps focus (bg is inert via top layer), so this is a
  // false positive. Documenting current (buggy) behavior:
  expect(rules).toContain("focus-escapes-modal");
});
