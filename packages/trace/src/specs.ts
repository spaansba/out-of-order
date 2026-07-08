import type { Severity } from "@out-of-order/core";
import type { Tip } from "./tooltip.js";

export interface StopSpec {
  element: Element;
  label: string;
  severity: Severity | null;
  inSeq: boolean;
  autofocus: boolean;
  /** Rides a fixed/sticky ancestor: anchor scroll compensation misses those, so
      its badge/hops are position:fixed instead of document-space. */
  floats: boolean;
  tip: Tip;
}

export interface SegmentSpec {
  back: boolean;
  tip: Tip;
}
