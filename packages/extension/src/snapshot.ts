import {
  formatViolations,
  flaggedEntries,
  reportText,
  type AuditFormat,
  type AuditResult,
  type Entry,
} from "@out-of-order/core";
import type { AuditSnapshot } from "./protocol.js";

/** Violations on page content proper: pages that embed the trace overlay
    themselves would otherwise report the overlay's own controls. */
export function pageViolations(result: AuditResult): Entry[] {
  return flaggedEntries(result).filter((entry) => !entry.element.closest(".ooo-layer"));
}

const scopedResult = (result: AuditResult, violations: Entry[]): AuditResult => ({
  valid: result.valid,
  sequence: violations,
  offSequence: [],
});

/** The snapshot's violations index-align with the given live list, so the panel
    can point back at an element by array index alone. */
export function buildSnapshot(result: AuditResult, violations: Entry[]): AuditSnapshot {
  return {
    valid: result.valid,
    stopCount: result.sequence.filter((stop) => !stop.element.closest(".ooo-layer")).length,
    violations: formatViolations(scopedResult(result, violations), "by-element"),
  };
}

/** Render one copy format to a string. Deferred to copy time so the hot
    re-analysis path never builds reports nobody asked for. */
export function formatReport(
  result: AuditResult,
  violations: Entry[],
  format: AuditFormat,
): string {
  return reportText(scopedResult(result, violations), format);
}
