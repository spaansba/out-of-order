import { addCopySplit } from "@out-of-order/trace";
import type { AuditFormat } from "@out-of-order/core";
import {
  DEFAULT_SETTINGS,
  PANEL_PORT,
  type AuditSnapshot,
  type ContentMessage,
  type OverlaySettings,
  type PanelMessage,
} from "./protocol.js";
import { buildSettings, renderSnapshot, renderStatus } from "./panel-view.js";

const banner = mustFind<HTMLElement>("#status");
const grantButton = mustFind<HTMLButtonElement>("#grant");
const results = mustFind<HTMLElement>("#results");
const copyWrap = mustFind<HTMLElement>("#copy");
const settingsToggle = mustFind<HTMLButtonElement>("#settings-toggle");
const settingsPanel = mustFind<HTMLElement>("#settings");

const ALL_SITES: chrome.permissions.Permissions = { origins: ["<all_urls>"] };
const SETTINGS_KEY = "ooo:settings";
const FORMAT_KEY = "ooo:copy-format";
const FORMATS: AuditFormat[] = ["text", "by-element", "by-violation", "flat"];

let port: chrome.runtime.Port | null = null;
let currentTabId: number | null = null;
let panelWindowId: number | null = null;
let settings = loadSettings();
let lastSnapshot: AuditSnapshot | null = null;
let findingCards: HTMLElement[] = [];

function mustFind<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`panel.html is missing ${selector}`);
  }
  return element;
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
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  if (push) {
    port?.postMessage({ kind: "settings", settings } satisfies PanelMessage);
  }
}

const settingsView = buildSettings(settingsPanel, settings, {
  // Hiding the overlay ends a peek; mirror that here so a stale peek=true isn't
  // pushed to the next page.
  onOverlay: (on) => {
    patchSettings(on ? { overlay: on } : { overlay: on, peek: false });
    settingsView.syncState(settings.overlay, settings.peek);
  },
  onPeek: (on) => {
    patchSettings({ peek: on });
    settingsView.syncState(settings.overlay, settings.peek);
  },
  onMotion: (on) => patchSettings({ motion: on }),
});

settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});

const savedFormat = localStorage.getItem(FORMAT_KEY) as AuditFormat | null;
addCopySplit(
  copyWrap,
  {
    format: savedFormat && FORMATS.includes(savedFormat) ? savedFormat : "by-element",
    onFormat: (format) => {
      try {
        localStorage.setItem(FORMAT_KEY, format);
      } catch {}
    },
    getReport: (format) => lastSnapshot?.reports[format] ?? "",
  },
  new AbortController().signal,
);

const RESTRICTED =
  /^(chrome|chrome-extension|devtools|edge|about|view-source):|^https:\/\/chromewebstore\.google\.com\//;

/** Inject the analyzer into the tab (idempotent) and keep a port open to it.
    The content script mounts the overlay while the port lives and pushes a
    fresh snapshot on every DOM change, so there is nothing to poll. */
async function attach(tabId: number, url: string | undefined): Promise<void> {
  detach();
  currentTabId = tabId;
  lastSnapshot = null;
  copyWrap.hidden = true;
  renderStatus(banner, null);
  grantButton.hidden = true;
  if (url && RESTRICTED.test(url)) {
    results.replaceChildren();
    renderStatus(banner, "info", "Chrome doesn't allow extensions on this page.");
    return;
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (error) {
    results.replaceChildren();
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
      lastSnapshot = message.snapshot;
      copyWrap.hidden = false;
      findingCards = renderSnapshot(results, message.snapshot, focusViolation);
    } else if (message.kind === "state") {
      // The page is authoritative: the peek key over there flips state too.
      patchSettings({ overlay: message.visible, peek: message.peeking }, false);
      settingsView.syncState(message.visible, message.peeking);
    } else if (message.kind === "focused") {
      highlightFinding(message.index);
    } else if (message.kind === "error") {
      results.replaceChildren();
      renderStatus(banner, "error", `Can't audit this page. (${message.message})`);
    }
  });
  opened.onDisconnect.addListener(() => {
    // Read lastError so a page moving into the back/forward cache (which closes
    // the port) doesn't log "Unchecked runtime.lastError".
    void chrome.runtime.lastError;
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

void (async () => {
  panelWindowId = (await chrome.windows.getCurrent()).id ?? null;
  await attachActive();
})();
