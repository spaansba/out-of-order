import type { AuditFormat, ByElement } from "@out-of-order/core";

export const PANEL_PORT = "ooo-panel";

export const FORMATS: AuditFormat[] = ["text", "by-element", "by-violation", "flat"];

/** Serializable audit result that crosses the panel/content-script boundary.
    Reports are not included: they are formatted on demand at copy time. */
export interface AuditSnapshot {
  stopCount: number;
  violations: ByElement[];
}

export interface OverlaySettings {
  overlay: boolean;
  peek: boolean;
  motion: boolean;
}

export const DEFAULT_SETTINGS: OverlaySettings = {
  overlay: true,
  peek: false,
  motion: true,
};

/** Panel -> content script, over the port. */
export type PanelMessage =
  | { kind: "focus-violation"; index: number }
  | { kind: "settings"; settings: OverlaySettings }
  | { kind: "report-request"; format: AuditFormat };

/** Content script -> panel, over the port. Pushed on connect and on every
    re-analysis that changes the verdict. */
export type ContentMessage =
  | { kind: "audit"; snapshot: AuditSnapshot }
  | { kind: "report"; format: AuditFormat; text: string }
  | { kind: "state"; visible: boolean; peeking: boolean }
  | { kind: "focused"; index: number | null }
  | { kind: "error"; message: string };
