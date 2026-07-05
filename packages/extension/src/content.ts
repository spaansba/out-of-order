import type { AuditResult, Entry } from "@out-of-order/core";
import {
  EXTENSION_ACTIVE_EVENT,
  TRACE_ACTIVE_EVENT,
  trace,
  type TraceHandle,
} from "@out-of-order/trace";
import { buildSnapshot, formatReport, pageViolations } from "./snapshot.js";
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
  let lastResult: AuditResult | null = null;
  let lastViolations: Entry[] = [];

  const claimPage = (): void => {
    document.dispatchEvent(new CustomEvent(EXTENSION_ACTIVE_EVENT));
  };

  // A page-mounted trace() announces itself at mount; answer while attached so
  // one mounting after our claim (SPA route change, lazy init) still turns off.
  document.addEventListener(TRACE_ACTIVE_EVENT, () => {
    if (activePort) {
      claimPage();
    }
  });

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

  // The overlay lives exactly as long as a panel is connected.
  chrome.runtime.onConnect.addListener((port) => {
    overlay?.destroy();
    overlay = null;
    activePort = port;
    // Kill any overlay the page mounted itself so the two don't stack.
    claimPage();
    const post = (message: ContentMessage): void => port.postMessage(message);

    // trace re-analyzes on DOM mutation, so pushing from onResult keeps the
    // panel live without polling. Only verdict changes are worth a repaint.
    let lastSent = "";
    try {
      overlay = trace({
        controls: false,
        yieldToExtension: false,
        onResult: (result) => {
          lastResult = result;
          lastViolations = pageViolations(result);
          const snapshot = buildSnapshot(result, lastViolations);
          const key = JSON.stringify(snapshot);
          if (key === lastSent) {
            return;
          }
          lastSent = key;
          post({ kind: "audit", snapshot });
        },
        onStateChange: (state) => post({ kind: "state", ...state }),
      });
    } catch (error) {
      post({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      return;
    }

    // Follow the keyboard: tell the panel which violating element holds focus
    // so it can scroll that finding into view. composedPath sees through shadow
    // roots, where event.target is retargeted to the host.
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.composedPath()[0];
      const index = lastViolations.findIndex((violation) => violation.element === target);
      post({ kind: "focused", index: index === -1 ? null : index });
    };
    window.addEventListener("focusin", onFocusIn);

    port.onMessage.addListener((message: PanelMessage) => {
      if (message.kind === "focus-violation") {
        focusViolation(message.index);
      } else if (message.kind === "report-request" && lastResult) {
        const text = formatReport(lastResult, lastViolations, message.format);
        post({ kind: "report", format: message.format, text });
      } else if (message.kind === "settings" && overlay) {
        const { settings } = message;
        overlay.setVisible(settings.overlay);
        overlay.setPeek(settings.peek);
        overlay.setMotion(settings.motion ? "auto" : "off");
      }
    });

    port.onDisconnect.addListener(() => {
      // Read lastError so a bfcache'd page (its end of the port dies with it)
      // doesn't log "Unchecked runtime.lastError".
      void chrome.runtime.lastError;
      window.removeEventListener("focusin", onFocusIn);
      if (activePort !== port) {
        return;
      }
      activePort = null;
      overlay?.destroy();
      overlay = null;
    });
  });
}
