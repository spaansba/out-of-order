import { SIDE_PANEL_PORT, type SidePanelMessage, type WorkerMessage } from "./protocol.js";

// Chrome's openPanelOnActionClick only opens, it never toggles closed. Handle
// the action click ourselves so a second click also closes the panel. Opening
// must stay synchronous inside the click gesture, so we track which windows have
// an open panel via its port (which also keeps this worker alive while open).
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

const openPanels = new Map<number, chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== SIDE_PANEL_PORT) {
    return;
  }
  let windowId: number | null = null;
  port.onMessage.addListener((message: SidePanelMessage) => {
    windowId = message.windowId;
    openPanels.set(windowId, port);
  });
  port.onDisconnect.addListener(() => {
    if (windowId !== null && openPanels.get(windowId) === port) {
      openPanels.delete(windowId);
    }
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId === undefined) {
    return;
  }
  const open = openPanels.get(tab.windowId);
  if (open) {
    open.postMessage({ kind: "close" } satisfies WorkerMessage);
  } else {
    // No await before open(): sidePanel.open() needs the click's user gesture.
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});
