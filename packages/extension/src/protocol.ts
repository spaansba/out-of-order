import type { ByElement } from "@out-of-order/core";

export const PANEL_PORT = "ooo-panel";

/** Serializable audit result that crosses the panel/content-script boundary. */
export interface AuditSnapshot {
  url: string;
  valid: boolean;
  stopCount: number;
  violations: ByElement[];
  ranAt: number;
}

/** Panel -> content script, over the port. */
export type PanelMessage = { kind: "focus-violation"; index: number };

/** Content script -> panel, over the port. Pushed on connect and on every
    re-analysis that changes the verdict. */
export type ContentMessage = { kind: "audit"; snapshot: AuditSnapshot };
