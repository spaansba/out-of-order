import { afterEach, describe, expect, test } from "vitest";
import { audit, formatViolations } from "../src/index.js";
import { ALL_RULES } from "../src/rules.js";
import type { RuleId, Violation } from "../src/index.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("audit", () => {
  test("reports an empty, valid result when nothing is focusable", () => {
    document.body.innerHTML = "<p>just text</p><span>more</span>";
    const result = audit(document.body);
    expect(result.valid).toBe(true);
    expect(result.sequence).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });

  test("numbers the sequence in tab order with real geometry", () => {
    document.body.innerHTML = '<button>A</button><a href="#">B</a>';
    const { sequence } = audit(document.body);
    expect(sequence.map((entry) => entry.element.tagName)).toEqual([
      "BUTTON",
      "A",
    ]);
    expect(sequence.map((entry) => entry.orderIndex)).toEqual([0, 1]);
    expect(sequence[0]!.selector).toContain("button");
    expect(sequence[0]!.rect.width).toBeGreaterThan(0);
  });

  test("treats a Document root as its documentElement", () => {
    document.body.innerHTML = '<button id="probe">X</button>';
    const ids = audit(document).sequence.map(
      (entry) => entry.element.id,
    );
    expect(ids).toContain("probe");
  });

  test("returns an empty result for a Document with no documentElement", () => {
    const empty = document.implementation.createDocument(null, null, null);
    expect(empty.documentElement).toBe(null);
    const result = audit(empty);
    expect(result.valid).toBe(true);
    expect(result.sequence).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });

  test("pierces an open shadow root", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    host.attachShadow({ mode: "open" }).innerHTML = "<button>Shadow</button>";
    const { sequence } = audit(host);
    expect(sequence).toHaveLength(1);
    expect(sequence[0]!.element.tagName).toBe("BUTTON");
  });

  test("disabling a rule drops only that rule's violations", () => {
    document.body.innerHTML =
      '<button>Fine</button><button tabindex="3">Jumped</button>';
    const fired = (options?: Parameters<typeof audit>[1]) =>
      new Set(
        audit(document.body, options).violations.map((v) => v.rule),
      );
    expect(fired()).toContain("no-positive-tabindex");
    expect(fired({ rules: { "no-positive-tabindex": "off" } })).not.toContain(
      "no-positive-tabindex",
    );
  });

  test("a violation carries the offending element and its rule's docs link", () => {
    document.body.innerHTML = "<button></button>"; // unnamed → missing-accessible-name
    const violation = audit(document.body).violations.find(
      (v) => v.rule === "missing-accessible-name",
    )!;
    expect(violation.element).toBe(document.querySelector("button"));
    expect(violation.orderIndex).toBe(0);
    expect(violation.selector).not.toBe("");
    expect(violation.docs).toBe(ALL_RULES["missing-accessible-name"].docs);
  });

  test("focus-escapes-modal collapses leaked background controls into one finding", () => {
    document.body.innerHTML =
      '<button>Bg1</button><button>Bg2</button><a href="#x">Bg3</a>' +
      '<div role="dialog" aria-modal="true"><button>Inside</button></div>';
    const leaks = audit(document.body).violations.filter(
      (v) => v.rule === "focus-escapes-modal",
    );
    expect(leaks).toHaveLength(1);
    // Three controls leak; the first is the primary, the other two ride along.
    expect(leaks[0]!.relatedElements).toHaveLength(2);
  });
});

describe("severity", () => {
  test("stamps each rule's default severity onto its violations", () => {
    document.body.innerHTML = '<button tabindex="1">Jump</button>';
    const violation = audit(document.body).violations.find(
      (v) => v.rule === "no-positive-tabindex",
    )!;
    expect(violation.severity).toBe("error");
  });

  test("warnings are advisory: a warning-only result stays valid", () => {
    // redundant-tabindex is a warning, and the only rule this trips.
    document.body.innerHTML = '<button tabindex="0">Save</button>';
    const result = audit(document.body);
    expect(result.violations.map((v) => v.rule)).toContain("redundant-tabindex");
    expect(result.violations.every((v) => v.severity === "warning")).toBe(true);
    expect(result.valid).toBe(true);
  });

  test("an error makes the result invalid", () => {
    document.body.innerHTML = '<button tabindex="1">Jump</button>';
    expect(audit(document.body).valid).toBe(false);
  });

  test("a rule can be re-graded to a different severity", () => {
    document.body.innerHTML = '<button tabindex="1">Jump</button>';
    const result = audit(document.body, {
      rules: { "no-positive-tabindex": "warning" },
    });
    const violation = result.violations.find(
      (v) => v.rule === "no-positive-tabindex",
    )!;
    expect(violation.severity).toBe("warning");
    // Demoted to a warning, so it no longer fails the result.
    expect(result.valid).toBe(true);
  });

  test('"off" disables a rule', () => {
    document.body.innerHTML = '<button tabindex="1">Jump</button>';
    const fired = audit(document.body, {
      rules: { "no-positive-tabindex": "off" },
    }).violations.map((v) => v.rule);
    expect(fired).not.toContain("no-positive-tabindex");
  });
});

describe("rule metadata", () => {
  test("every rule has an absolute https docs link", () => {
    for (const rule of Object.values(ALL_RULES)) {
      expect(rule.docs).toMatch(/^https:\/\/\S+$/);
    }
  });
});

describe("formatViolations", () => {
  const make = (over: Partial<Violation>): Violation => ({
    rule: "no-positive-tabindex" as RuleId,
    severity: "error",
    message: "msg",
    docs: "https://example.test/doc",
    element: document.createElement("button"),
    selector: "button",
    ...over,
  });

  test("reads clearly when there are no violations", () => {
    expect(formatViolations([])).toBe("No tab-order violations.");
  });

  test("includes the rule, message and docs link", () => {
    const out = formatViolations([make({ orderIndex: 0 })]);
    expect(out).toContain("[no-positive-tabindex]");
    expect(out).toContain("msg");
    expect(out).toContain("docs: https://example.test/doc");
  });

  test("shows the tab position only when the violation has one", () => {
    expect(formatViolations([make({ orderIndex: 2 })])).toContain("(tab #3)");
    expect(formatViolations([make({})])).not.toContain("(tab #");
  });

  test("numbers multiple violations", () => {
    const out = formatViolations([make({}), make({})]);
    expect(out).toContain("1. ");
    expect(out).toContain("2. ");
  });

  test("lists related elements by selector when present", () => {
    const related = document.createElement("a");
    related.id = "next";
    const out = formatViolations([make({ relatedElements: [related] })]);
    expect(out).toContain("related: a#next");
    expect(formatViolations([make({})])).not.toContain("related:");
  });
});
