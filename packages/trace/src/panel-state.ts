import type { AuditFormat } from "@out-of-order/core";

const PANEL_STATE_KEY = "ooo:trace";

export interface PanelState {
  visible: boolean;
  peek: boolean;
  open: boolean;
  copyFormat: AuditFormat;
}

export function loadPanelState(): Partial<PanelState> {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_STATE_KEY) ?? "{}");
    return saved !== null && typeof saved === "object" ? (saved as Partial<PanelState>) : {};
  } catch {
    return {};
  }
}

export function patchPanelState(patch: Partial<PanelState>): void {
  try {
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify({ ...loadPanelState(), ...patch }));
  } catch {}
}
