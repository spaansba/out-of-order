import { afterEach, describe, expect, test, vi } from "vitest";
import { audit } from "./index.js";
import { ALL_RULES } from "./rules/index.js";

afterEach(() => {
  document.body.innerHTML = "";
});

const allIssues = (root: Document | Element, options?: Parameters<typeof audit>[1]) =>
  audit(root, options).violations.flatMap((violation) => violation.issues);

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
    expect(sequence.map((entry) => entry.element.tagName)).toEqual(["BUTTON", "A"]);
    expect(sequence.map((entry) => entry.orderIndex)).toEqual([0, 1]);
    expect(sequence[0]!.selector).toContain("button");
    expect(sequence[0]!.rect.width).toBeGreaterThan(0);
  });

  test("treats a Document root as its documentElement", () => {
    document.body.innerHTML = '<button id="probe">X</button>';
    const ids = audit(document).sequence.map((entry) => entry.element.id);
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

  test("disabling a rule drops only that rule's issues", () => {
    document.body.innerHTML = '<button>Fine</button><button tabindex="3">Jumped</button>';
    const fired = (options?: Parameters<typeof audit>[1]) =>
      new Set(allIssues(document.body, options).map((issue) => issue.rule));
    expect(fired()).toContain("no-positive-tabindex");
    expect(fired({ rules: { "no-positive-tabindex": "off" } })).not.toContain(
      "no-positive-tabindex",
    );
  });

  test("groups an element's issues under one violation with its docs link", () => {
    document.body.innerHTML = "<button></button>"; // unnamed → missing-accessible-name
    const violation = audit(document.body).violations.find((v) =>
      v.issues.some((issue) => issue.rule === "missing-accessible-name"),
    )!;
    expect(violation.element).toBe(document.querySelector("button"));
    expect(violation.orderIndex).toBe(0);
    expect(violation.selector).not.toBe("");
    const issue = violation.issues.find((i) => i.rule === "missing-accessible-name")!;
    expect(issue.docs).toBe(ALL_RULES["missing-accessible-name"].docs);
  });

  test("keeps orderIndex when a bare-element finding hits a tab stop", () => {
    // duplicate-autofocus targets bare Elements; the loser is still a tab stop.
    document.body.innerHTML = "<button autofocus>A</button><button autofocus>B</button>";
    const second = document.querySelectorAll("button")[1]!;
    const violation = audit(document.body).violations.find((v) => v.element === second)!;
    expect(violation.issues.map((i) => i.rule)).toContain("duplicate-autofocus");
    expect(violation.orderIndex).toBe(1);
  });

  test("focus-escapes-modal collapses leaked background controls into one issue", () => {
    document.body.innerHTML =
      '<button>Bg1</button><button>Bg2</button><a href="#x">Bg3</a>' +
      '<div role="dialog" aria-modal="true"><button>Inside</button></div>';
    const leaks = allIssues(document.body).filter((issue) => issue.rule === "focus-escapes-modal");
    expect(leaks).toHaveLength(1);
    // Three controls leak; the first is the primary, the other two ride along.
    expect(leaks[0]!.relatedElements).toHaveLength(2);
  });

  test("composite-roving-tabindex collapses a widget's items into one issue", () => {
    document.body.innerHTML =
      '<div role="toolbar" aria-label="Format">' +
      '<button tabindex="0">A</button><button tabindex="0">B</button><button tabindex="0">C</button>' +
      "</div>";
    const roving = allIssues(document.body).filter(
      (issue) => issue.rule === "composite-roving-tabindex",
    );
    expect(roving).toHaveLength(1);
    // Three separate stops; the first is primary, the other two ride along.
    expect(roving[0]!.relatedElements).toHaveLength(2);
  });

  test("warns once for a rules key that names no known rule", () => {
    document.body.innerHTML = "<button>Ok</button>";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const options = { rules: { "totally-made-up-rule": "off" } } as Parameters<typeof audit>[1];
    try {
      audit(document.body, options);
      audit(document.body, options);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain("totally-made-up-rule");
    } finally {
      warn.mockRestore();
    }
  });

  test("warns once when a custom rule reuses a built-in rule id", () => {
    document.body.innerHTML = "<button>Ok</button>";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const shadowing = { id: "no-positive-tabindex", severity: "error", run: () => [] };
    const options = { customRules: [shadowing] } as unknown as Parameters<typeof audit>[1];
    try {
      audit(document.body, options);
      audit(document.body, options);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain("no-positive-tabindex");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("severity", () => {
  test("stamps each rule's default severity onto its issues", () => {
    document.body.innerHTML = '<button tabindex="1">Jump</button>';
    const issue = allIssues(document.body).find((i) => i.rule === "no-positive-tabindex")!;
    expect(issue.severity).toBe("error");
  });

  test("warnings are advisory: a warning-only result stays valid", () => {
    // redundant-tabindex is a warning, and the only rule this trips.
    document.body.innerHTML = '<button tabindex="0">Save</button>';
    const result = audit(document.body);
    const issues = result.violations.flatMap((v) => v.issues);
    expect(issues.map((i) => i.rule)).toContain("redundant-tabindex");
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
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
    const issue = result.violations
      .flatMap((v) => v.issues)
      .find((i) => i.rule === "no-positive-tabindex")!;
    expect(issue.severity).toBe("warning");
    // Demoted to a warning, so it no longer fails the result.
    expect(result.valid).toBe(true);
  });

  test('"off" disables a rule', () => {
    document.body.innerHTML = '<button tabindex="1">Jump</button>';
    const fired = allIssues(document.body, {
      rules: { "no-positive-tabindex": "off" },
    }).map((i) => i.rule);
    expect(fired).not.toContain("no-positive-tabindex");
  });
});

describe("data-ooo-ignore", () => {
  test("a bare attribute approves every finding on the element", () => {
    document.body.innerHTML = "<button data-ooo-ignore></button>"; // unnamed
    const result = audit(document.body);
    const issues = result.violations.flatMap((v) => v.issues);
    expect(issues.some((i) => i.rule === "missing-accessible-name")).toBe(true);
    // Still reported, just approved: it stays in the result, flagged ignored.
    expect(issues.every((i) => i.ignored)).toBe(true);
    // An ignored error no longer fails the result.
    expect(result.valid).toBe(true);
  });

  test("a valued attribute silences only the listed rules", () => {
    // Two errors on one element: a positive tabindex and no accessible name.
    document.body.innerHTML =
      '<button tabindex="1" data-ooo-ignore="no-positive-tabindex"></button>';
    const issues = audit(document.body).violations.flatMap((v) => v.issues);
    const positive = issues.find((i) => i.rule === "no-positive-tabindex")!;
    const unnamed = issues.find((i) => i.rule === "missing-accessible-name")!;
    expect(positive.ignored).toBe(true);
    expect(unnamed.ignored).toBeFalsy();
    // The unlisted error still stands, so the result stays invalid.
    expect(audit(document.body).valid).toBe(false);
  });

  test("is element-scoped: an ancestor's attribute doesn't cover a child", () => {
    document.body.innerHTML = "<div data-ooo-ignore><button></button></div>";
    const result = audit(document.body);
    const unnamed = result.violations
      .flatMap((v) => v.issues)
      .find((i) => i.rule === "missing-accessible-name")!;
    expect(unnamed.ignored).toBeFalsy();
    expect(result.valid).toBe(false);
  });
});

describe("rule metadata", () => {
  test("every rule has an absolute https docs link", () => {
    for (const rule of Object.values(ALL_RULES)) {
      expect(rule.docs).toMatch(/^https:\/\/\S+$/);
    }
  });
});
