import type { AuditFormat, ByElement } from "@out-of-order/core";

export const PANEL_PORT = "ooo-panel";
export const SIDE_PANEL_PORT = "ooo-sidepanel";

/** Panel -> service worker: which window this panel is docked in, so a repeat
    action click can toggle the right one closed. */
export type SidePanelMessage = { kind: "register"; windowId: number };

/** Service worker -> panel: Chrome has no sidePanel.close(), so the panel must
    close itself. */
export type WorkerMessage = { kind: "close" };

/** Serializable audit result that crosses the panel/content-script boundary. */
export interface AuditSnapshot {
  valid: boolean;
  stopCount: number;
  violations: ByElement[];
  reports: Record<AuditFormat, string>;
  ranAt: number;
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
  | { kind: "settings"; settings: OverlaySettings };

/** Content script -> panel, over the port. Pushed on connect and on every
    re-analysis that changes the verdict. */
export type ContentMessage =
  | { kind: "audit"; snapshot: AuditSnapshot }
  | { kind: "state"; visible: boolean; peeking: boolean }
  | { kind: "focused"; index: number | null }
  | { kind: "error"; message: string };
