import { afterEach, describe, expect, test } from "vitest";
import { audit, formatViolations, flaggedEntries } from "./index.js";
import { ALL_RULES } from "./rules/index.js";

afterEach(() => {
  document.body.innerHTML = "";
});

// A positive tabindex (no-positive-tabindex) and an unnamed button
// (missing-accessible-name): two rules across two elements.
const markup = '<button tabindex="1">Jump</button><button></button>';

describe("formatViolations", () => {
  test("text renders a human-readable string", () => {
    document.body.innerHTML = markup;
    const text = formatViolations(audit(document.body), "text");
    expect(typeof text).toBe("string");
    expect(text).toContain("no-positive-tabindex");
  });

  test("text includes each issue's docs link, the spec people paste into a PR", () => {
    document.body.innerHTML = markup;
    const text = formatViolations(audit(document.body), "text");
    expect(text).toContain(ALL_RULES["no-positive-tabindex"].docs);
  });

  test("text says so when there is nothing to report", () => {
    document.body.innerHTML = "<p>just text</p>";
    expect(formatViolations(audit(document.body), "text")).toBe("No tab-order issues.");
  });

  test("by-element mirrors the flagged entries with selectors, no live nodes", () => {
    document.body.innerHTML = markup;
    const entries = formatViolations(audit(document.body), "by-element");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      selector: expect.any(String),
      issues: expect.any(Array),
    });
    expect(entries[0]!.issueCount).toBe(entries[0]!.issues.length);
    expect("element" in entries[0]!).toBe(false);
    // Round-trips through JSON, unlike the live-Element result.
    expect(() => JSON.stringify(entries)).not.toThrow();
  });

  test("by-violation groups per rule, errors first", () => {
    document.body.innerHTML = markup;
    const entries = formatViolations(audit(document.body), "by-violation");
    const rules = entries.map((entry) => entry.rule);
    expect(rules).toContain("no-positive-tabindex");
    expect(rules).toContain("missing-accessible-name");
    expect(new Set(rules).size).toBe(rules.length);
    for (const entry of entries) {
      expect(entry.elementCount).toBe(entry.elements.length);
      expect(entry.elements[0]!.selector).toEqual(expect.any(String));
    }
    const severities = entries.map((entry) => entry.severity);
    expect(severities.indexOf("error")).toBeLessThan(
      severities.includes("warning") ? severities.indexOf("warning") : severities.length,
    );
    expect(() => JSON.stringify(entries)).not.toThrow();
  });

  test("flat yields one entry per element-issue pair", () => {
    document.body.innerHTML = markup;
    const result = audit(document.body);
    const flat = formatViolations(result, "flat");
    const total = flaggedEntries(result).reduce((sum, entry) => sum + entry.issues.length, 0);
    expect(flat).toHaveLength(total);
    expect(flat[0]).toMatchObject({
      selector: expect.any(String),
      rule: expect.any(String),
      message: expect.any(String),
    });
    expect(() => JSON.stringify(flat)).not.toThrow();
  });

  test("views surface a data-ooo-ignore approval", () => {
    document.body.innerHTML = "<button data-ooo-ignore></button>";
    const result = audit(document.body);
    expect(formatViolations(result, "text")).toContain("ignored via data-ooo-ignore");
    const entries = formatViolations(result, "by-element");
    expect(entries.some((entry) => entry.issues.some((issue) => issue.ignored))).toBe(true);
    expect(formatViolations(result, "flat").every((issue) => issue.ignored)).toBe(true);
  });
});
