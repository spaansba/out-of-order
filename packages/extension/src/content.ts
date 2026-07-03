import type { Violation } from "@out-of-order/core";
import { trace, type TraceHandle } from "@out-of-order/trace";
import { buildSnapshot, pageViolations } from "./snapshot.js";
import type { ContentMessage, PanelMessage } from "./protocol.js";

declare global {
  interface Window {
    __oooExtension?: boolean;
  }
}

if (!window.__oooExtension) {
  window.__oooExtension = true;

  let overlay: TraceHandle | null = null;
  let activePort: chrome.runtime.Port | null = null;
  let lastViolations: Violation[] = [];

  const focusViolation = (index: number): void => {
    const element = lastViolations[index]?.element;
    if (!element?.isConnected) {
      return;
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    element.animate(
      [
        { boxShadow: "0 0 0 4px rgba(160, 31, 23, 0.85)" },
        { boxShadow: "0 0 0 4px rgba(160, 31, 23, 0)" },
      ],
      { duration: 700, iterations: 2 },
    );
  };

  // The overlay lives exactly as long as a panel is connected: mounted on
  // connect, torn down on disconnect (panel closed, tab switched away, or the
  // panel attached to another tab).
  chrome.runtime.onConnect.addListener((port) => {
    overlay?.destroy();
    activePort = port;

    // trace re-analyzes on DOM mutation, so pushing from onResult keeps the
    // panel live without polling. ranAt is excluded from the dedupe key: every
    // rebuild reports, but only verdict changes are worth a repaint.
    let lastSent = "";
    overlay = trace({
      controls: false,
      onResult: (result) => {
        lastViolations = pageViolations(result);
        const snapshot = buildSnapshot(result, lastViolations);
        const key = JSON.stringify([snapshot.valid, snapshot.stopCount, snapshot.violations]);
        if (key === lastSent) {
          return;
        }
        lastSent = key;
        port.postMessage({ kind: "audit", snapshot } satisfies ContentMessage);
      },
    });

    port.onMessage.addListener((message: PanelMessage) => {
      if (message.kind === "focus-violation") {
        focusViolation(message.index);
      }
    });

    port.onDisconnect.addListener(() => {
      if (activePort !== port) {
        return;
      }
      activePort = null;
      overlay?.destroy();
      overlay = null;
    });
  });
}
