import {
  formatViolations,
  flaggedEntries,
  type AuditFormat,
  type AuditResult,
  type Entry,
} from "@out-of-order/core";
import { FORMATS, type AuditSnapshot } from "./protocol.js";

/** Violations on page content proper: pages that embed the trace overlay
    themselves would otherwise report the overlay's own controls. */
export function pageViolations(result: AuditResult): Entry[] {
  return flaggedEntries(result).filter((entry) => !entry.element.closest(".ooo-layer"));
}

/** The snapshot's violations index-align with the given live list, so the panel
    can point back at an element by array index alone. */
export function buildSnapshot(result: AuditResult, violations: Entry[]): AuditSnapshot {
  const scoped: AuditResult = { valid: result.valid, sequence: violations, offSequence: [] };
  const byElement = formatViolations(scoped, "by-element");
  const report = (format: AuditFormat): string => {
    const rendered = format === "by-element" ? byElement : formatViolations(scoped, format);
    return typeof rendered === "string" ? rendered : JSON.stringify(rendered, null, 2);
  };
  return {
    valid: result.valid,
    stopCount: result.sequence.filter((stop) => !stop.element.closest(".ooo-layer")).length,
    violations: byElement,
    reports: Object.fromEntries(FORMATS.map((f) => [f, report(f)])) as Record<AuditFormat, string>,
  };
}
