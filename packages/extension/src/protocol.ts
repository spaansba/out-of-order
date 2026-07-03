import type { AuditFormat, ByElement } from "@out-of-order/core";

export const PANEL_PORT = "ooo-panel";

/** Serializable audit result that crosses the panel/content-script boundary. */
export interface AuditSnapshot {
  valid: boolean;
  stopCount: number;
  violations: ByElement[];
  /** The findings pre-rendered in every copyable format (JSON ones stringified),
      so the panel's copy button never needs a round trip. */
  reports: Record<AuditFormat, string>;
  ranAt: number;
}

/** Overlay preferences the panel owns and pushes to the content script. */
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
  | { kind: "settings"; settings: OverlaySettings };

/** Content script -> panel, over the port. An audit is pushed on connect and on
    every re-analysis that changes the verdict. */
export type ContentMessage =
  | { kind: "audit"; snapshot: AuditSnapshot }
  | { kind: "state"; visible: boolean; peeking: boolean }
  | { kind: "focused"; index: number | null }
  | { kind: "error"; message: string };
