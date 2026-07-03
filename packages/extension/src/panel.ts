import { PANEL_PORT, type ContentMessage, type PanelMessage } from "./protocol.js";
import { renderIdle, renderSnapshot, renderStatus } from "./panel-view.js";

const target = mustFind<HTMLElement>("#target");
const banner = mustFind<HTMLElement>("#status");
const grantButton = mustFind<HTMLButtonElement>("#grant");
const results = mustFind<HTMLElement>("#results");

const ALL_SITES: chrome.permissions.Permissions = { origins: ["<all_urls>"] };

let port: chrome.runtime.Port | null = null;
let currentTabId: number | null = null;
let panelWindowId: number | null = null;

function mustFind<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`panel.html is missing ${selector}`);
  }
  return element;
}

const RESTRICTED =
  /^(chrome|chrome-extension|devtools|edge|about|view-source):|^https:\/\/chromewebstore\.google\.com\//;

/** Inject the analyzer into the tab (idempotent) and keep a port open to it.
    The content script mounts the overlay while the port lives and pushes a
    fresh snapshot on every DOM change, so there is nothing to poll. */
async function attach(tabId: number, url: string | undefined): Promise<void> {
  detach();
  currentTabId = tabId;
  renderStatus(banner, null);
  grantButton.hidden = true;
  if (url && RESTRICTED.test(url)) {
    target.textContent = "";
    renderIdle(results);
    renderStatus(banner, "info", "Chrome doesn't allow extensions on this page.");
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (error) {
    target.textContent = "";
    renderIdle(results);
    if (!(await chrome.permissions.contains(ALL_SITES))) {
      renderStatus(
        banner,
        "info",
        "Out of Order needs access to the sites you want to audit. Allow it once below.",
      );
      grantButton.hidden = false;
      return;
    }
    const detail = error instanceof Error ? error.message : String(error);
    renderStatus(banner, "error", `Can't audit this page. (${detail})`);
    return;
  }
  const opened = chrome.tabs.connect(tabId, { name: PANEL_PORT });
  port = opened;
  opened.onMessage.addListener((message: ContentMessage) => {
    if (message.kind === "audit") {
      target.textContent = hostOf(message.snapshot.url);
      renderSnapshot(results, message.snapshot, focusViolation);
    }
  });
  opened.onDisconnect.addListener(() => {
    // Navigation kills the content script and its port; onUpdated re-attaches.
    if (port === opened) {
      port = null;
    }
  });
}

function detach(): void {
  port?.disconnect();
  port = null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function focusViolation(index: number): void {
  port?.postMessage({ kind: "focus-violation", index } satisfies PanelMessage);
}

async function attachActive(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id !== undefined) {
    await attach(tab.id, tab.url);
  }
}

grantButton.addEventListener("click", () => {
  // Must run in the click handler: permissions.request needs a user gesture.
  void chrome.permissions.request(ALL_SITES).then((granted) => {
    if (granted) {
      void attachActive();
    }
  });
});

chrome.permissions.onAdded.addListener(() => void attachActive());

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (panelWindowId !== null && windowId !== panelWindowId) {
    return;
  }
  void chrome.tabs.get(tabId).then(
    (tab) => attach(tabId, tab.url),
    () => {},
  );
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === "complete") {
    void attach(tabId, tab.url);
  }
});

void (async () => {
  renderIdle(results);
  panelWindowId = (await chrome.windows.getCurrent()).id ?? null;
  await attachActive();
})();
