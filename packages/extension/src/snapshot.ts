import { formatViolations, type AuditFormat, type AuditResult, type Violation } from "@out-of-order/core";
import type { AuditSnapshot } from "./protocol.js";

/** Violations on page content proper: pages that embed the trace overlay
    themselves would otherwise report the overlay's own controls. */
export function pageViolations(result: AuditResult): Violation[] {
  return result.violations.filter((violation) => !violation.element.closest(".ooo-layer"));
}

/** The snapshot's violations index-align with the given live list, so the panel
    can point back at an element by array index alone. */
export function buildSnapshot(result: AuditResult, violations: Violation[]): AuditSnapshot {
  const scoped = { ...result, violations };
  const report = (format: AuditFormat): string => {
    const rendered = formatViolations(scoped, format);
    return typeof rendered === "string" ? rendered : JSON.stringify(rendered, null, 2);
  };
  return {
    valid: result.valid,
    stopCount: result.sequence.filter((stop) => !stop.element.closest(".ooo-layer")).length,
    violations: formatViolations(scoped, "by-element"),
    reports: {
      text: report("text"),
      "by-element": report("by-element"),
      "by-violation": report("by-violation"),
      flat: report("flat"),
    },
    ranAt: Date.now(),
  };
}
