import { afterEach, describe, expect, test } from "vitest";
import { fired } from "./test-helpers.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("focus-escapes-modal", () => {
  test("01 valid: modal with only its own controls", () => {
    expect(
      fired(
        '<div role="dialog" aria-modal="true"><button>OK</button><button>Cancel</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test("02 valid: background made inert while aria-modal open", () => {
    expect(
      fired(
        '<div inert><button>Home</button><button>Settings</button></div><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test("03 valid: background removed from tab order via tabindex=-1 (rule's own advice)", () => {
    expect(
      fired(
        '<div aria-hidden="true"><button tabindex="-1">Home</button></div><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test("04 valid: non-modal <dialog open> keeps background interactive", () => {
    expect(
      fired("<button>Background</button><dialog open><button>Inside</button></dialog>"),
    ).not.toContain("focus-escapes-modal");
  });
  test('05 valid: aria-modal="false" is not a modal', () => {
    expect(
      fired(
        '<button>Background</button><div role="dialog" aria-modal="false"><button>Inside</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test("06 valid: no modal present at all", () => {
    expect(fired('<button>One</button><a href="#x">Two</a>')).not.toContain("focus-escapes-modal");
  });
  test("07 invalid: aria-modal with tabbable background (genuine leak, no inert/trap)", () => {
    expect(
      fired(
        '<button>Background</button><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).toContain("focus-escapes-modal");
  });
  test("08 invalid: aria-hidden-only background is still tabbable", () => {
    expect(
      fired(
        '<div aria-hidden="true"><button>Background</button></div><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).toContain("focus-escapes-modal");
  });
  test("09 invalid: many background controls collapse into one finding", () => {
    expect(
      fired(
        '<button>BgOne</button><button>BgTwo</button><a href="#x">BgLink</a><div role="dialog" aria-modal="true"><button>Inside</button></div>',
      ),
    ).toContain("focus-escapes-modal");
  });
  test.fails("10 edge/KNOWN-BUG: correctly-built stacked modals (A inert background, B active)", () => {
    expect(
      fired(
        '<div role="dialog" aria-modal="true" inert><button>A action</button></div><div role="dialog" aria-modal="true"><button>B action</button></div>',
      ),
    ).not.toContain("focus-escapes-modal");
  });
  test('11 edge: role="alertdialog" modal with tabbable background', () => {
    expect(
      fired(
        '<button>Background</button><div role="alertdialog" aria-modal="true"><button>Confirm</button></div>',
      ),
    ).toContain("focus-escapes-modal");
  });
});
