import { addCopySplit, ensureIssueStyles, listenForPeekKey } from "@out-of-order/trace";
import type { AuditFormat } from "@out-of-order/core";
import {
  DEFAULT_SETTINGS,
  FORMATS,
  PANEL_PORT,
  type ContentMessage,
  type OverlaySettings,
  type PanelMessage,
} from "./protocol.js";
import { buildSettings, renderSnapshot, renderStatus, type StatusKind } from "./panel-view.js";

ensureIssueStyles();

const banner = mustFind<HTMLElement>("#status");
const grantButton = mustFind<HTMLButtonElement>("#grant");
const results = mustFind<HTMLElement>("#results");
const copyWrap = mustFind<HTMLElement>("#copy");
const settingsToggle = mustFind<HTMLButtonElement>("#settings-toggle");
const settingsPanel = mustFind<HTMLElement>("#settings");

const ALL_SITES: chrome.permissions.Permissions = { origins: ["<all_urls>"] };
const SETTINGS_KEY = "ooo:settings";
const FORMAT_KEY = "ooo:copy-format";

let port: chrome.runtime.Port | null = null;
let currentTabId: number | null = null;
let panelWindowId: number | null = null;
let settings = loadSettings();
let findingCards: HTMLElement[] = [];
const pendingReports = new Map<AuditFormat, (text: string) => void>();

function mustFind<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`panel.html is missing ${selector}`);
  }
  return element;
}

function saveLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function showBanner(kind: StatusKind, text: string): void {
  results.replaceChildren();
  renderStatus(banner, kind, text);
}

// The content script formats reports on demand, so a copy click round-trips to
// it rather than reading a pre-built string.
function requestReport(format: AuditFormat): Promise<string> {
  if (!port) {
    return Promise.resolve("");
  }
  return new Promise((resolve) => {
    pendingReports.set(format, resolve);
    port?.postMessage({ kind: "report-request", format } satisfies PanelMessage);
  });
}

function loadSettings(): OverlaySettings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    const patch = saved !== null && typeof saved === "object" ? saved : {};
    return { ...DEFAULT_SETTINGS, ...patch };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function patchSettings(patch: Partial<OverlaySettings>, push = true): void {
  settings = { ...settings, ...patch };
  saveLocal(SETTINGS_KEY, JSON.stringify(settings));
  settingsView.syncState(settings.overlay, settings.peek);
  if (push) {
    port?.postMessage({ kind: "settings", settings } satisfies PanelMessage);
  }
}

const settingsView = buildSettings(settingsPanel, settings, {
  // Hiding the overlay ends a peek; drop a stale peek=true so it isn't pushed to
  // the next page.
  onOverlay: (on) => patchSettings(on ? { overlay: on } : { overlay: on, peek: false }),
  onPeek: (on) => patchSettings({ peek: on }),
  onMotion: (on) => patchSettings({ motion: on }),
});

listenForPeekKey("Alt", undefined, () => {
  if (settings.overlay) {
    patchSettings({ peek: !settings.peek });
  }
});

settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});

const savedFormat = localStorage.getItem(FORMAT_KEY) as AuditFormat | null;
addCopySplit(copyWrap, {
  format: savedFormat && FORMATS.includes(savedFormat) ? savedFormat : "by-element",
  onFormat: (format) => saveLocal(FORMAT_KEY, format),
  getReport: requestReport,
});

const RESTRICTED =
  /^(chrome|chrome-extension|devtools|edge|about|view-source):|^https:\/\/chromewebstore\.google\.com\//;

/** Inject the analyzer into the tab (idempotent) and keep a port open to it.
    The content script mounts the overlay while the port lives and pushes a
    fresh snapshot on every DOM change, so there is nothing to poll. */
async function attach(tabId: number, url: string | undefined): Promise<void> {
  detach();
  currentTabId = tabId;
  copyWrap.hidden = true;
  renderStatus(banner, null);
  grantButton.hidden = true;
  if (url && RESTRICTED.test(url)) {
    showBanner("info", "Chrome doesn't allow extensions on this page.");
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (error) {
    if (!(await chrome.permissions.contains(ALL_SITES))) {
      showBanner(
        "info",
        "Out of Order needs access to the sites you want to audit. Allow it once below.",
      );
      grantButton.hidden = false;
      return;
    }
    const detail = error instanceof Error ? error.message : String(error);
    showBanner("error", `Can't audit this page. (${detail})`);
    return;
  }
  const opened = chrome.tabs.connect(tabId, { name: PANEL_PORT });
  port = opened;
  opened.onMessage.addListener((message: ContentMessage) => {
    if (message.kind === "audit") {
      copyWrap.hidden = false;
      findingCards = renderSnapshot(results, message.snapshot, focusViolation);
    } else if (message.kind === "report") {
      pendingReports.get(message.format)?.(message.text);
      pendingReports.delete(message.format);
    } else if (message.kind === "state") {
      // The page is authoritative: the peek key over there flips state too.
      patchSettings({ overlay: message.visible, peek: message.peeking }, false);
    } else if (message.kind === "focused") {
      highlightFinding(message.index);
    } else if (message.kind === "error") {
      showBanner("error", `Can't audit this page. (${message.message})`);
    }
  });
  opened.onDisconnect.addListener(() => {
    // Read lastError so a page moving into the back/forward cache (which closes
    // the port) doesn't log "Unchecked runtime.lastError".
    void chrome.runtime.lastError;
    // A copy awaiting a report the dead port will never answer resolves empty.
    for (const resolve of pendingReports.values()) {
      resolve("");
    }
    pendingReports.clear();
    // Navigation kills the content script and its port; onUpdated re-attaches.
    if (port === opened) {
      port = null;
    }
  });
  opened.postMessage({ kind: "settings", settings } satisfies PanelMessage);
}

function detach(): void {
  port?.disconnect();
  port = null;
}

function focusViolation(index: number): void {
  port?.postMessage({ kind: "focus-violation", index } satisfies PanelMessage);
}

function highlightFinding(index: number | null): void {
  for (const card of findingCards) {
    card.classList.remove("finding--focused");
  }
  const card = index === null ? undefined : findingCards[index];
  if (!card) {
    return;
  }
  card.classList.add("finding--focused");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
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

// Learn which window this panel is docked in so it only follows tab changes
// in its own window (onActivated fires for every window).
void (async () => {
  const currentWindow = chrome.windows.getCurrent();
  const attaching = attachActive();
  panelWindowId = (await currentWindow).id ?? null;
  await attaching;
})();
