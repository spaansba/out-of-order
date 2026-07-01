import type { AuditFormat } from "@out-of-order/core";
import type { ModifierKey } from "./index.js";

const COPY_FORMATS: { value: AuditFormat; label: string }[] = [
  { value: "by-element", label: "By element" },
  { value: "by-rule", label: "By rule" },
  { value: "flat", label: "Flat" },
  { value: "text", label: "Text" },
];

const PEEK_KEY_LABEL: Record<ModifierKey, string> = {
  Alt: "Alt",
  Control: "Ctrl",
  Shift: "Shift",
  Meta: "Meta",
};

const PANEL_STATE_KEY = "ooo:trace";

interface PanelState {
  visible: boolean;
  peek: boolean;
  open: boolean;
  copyFormat: AuditFormat;
}

export function loadPanelState(): Partial<PanelState> {
  try {
    return JSON.parse(sessionStorage.getItem(PANEL_STATE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function patchPanelState(patch: Partial<PanelState>): void {
  try {
    sessionStorage.setItem(
      PANEL_STATE_KEY,
      JSON.stringify({ ...loadPanelState(), ...patch }),
    );
  } catch {}
}

interface ControlsOptions {
  peekKey: ModifierKey;
  open: boolean;
  copyFormat: AuditFormat;
  onToggleVisible: () => void;
  onTogglePeek: () => void;
  onToggleOpen: (open: boolean) => void;
  getReport: (format: AuditFormat) => string;
}

interface Controls {
  syncVisible(shown: boolean): void;
  syncPeek(on: boolean): void;
  teardown(): void;
}

export function setupControls(
  layer: HTMLElement,
  opts: ControlsOptions,
): Controls {
  const {
    peekKey,
    open,
    copyFormat,
    onToggleVisible,
    onTogglePeek,
    onToggleOpen,
    getReport,
  } = opts;
  const abort = new AbortController();
  const signal = abort.signal;

  const panel = document.createElement("div");
  panel.className = "ooo-panel";
  panel.dataset.open = open ? "1" : "0";

  const title = buildTitle(panel, signal, onToggleOpen);
  const { body, visSwitch, peekSwitch } = buildBody(
    peekKey,
    signal,
    onToggleVisible,
    onTogglePeek,
    getReport,
    copyFormat,
  );
  panel.append(title, body);
  layer.appendChild(panel);

  listenForPeekKey(peekKey, signal, onTogglePeek);

  return {
    syncVisible: (shown) => {
      setSwitch(visSwitch, shown);
      // Click-through is meaningless with nothing drawn, so disable it while hidden.
      peekSwitch.disabled = !shown;
    },
    syncPeek: (on) => setSwitch(peekSwitch, on),
    teardown: () => {
      abort.abort();
      panel.remove();
    },
  };
}

function buildTitle(
  panel: HTMLElement,
  signal: AbortSignal,
  onToggleOpen: (open: boolean) => void,
): HTMLButtonElement {
  const title = document.createElement("button");
  title.type = "button";
  title.tabIndex = -1;
  title.className = "ooo-panel-title";
  title.textContent = "Out of Order";

  title.addEventListener("mousedown", (event) => event.preventDefault(), {
    signal,
  });

  title.addEventListener(
    "click",
    () => {
      const next = panel.dataset.open !== "1";
      panel.dataset.open = next ? "1" : "0";
      onToggleOpen(next);
    },
    { signal },
  );
  return title;
}

function buildBody(
  peekKey: ModifierKey,
  signal: AbortSignal,
  onToggleVisible: () => void,
  onTogglePeek: () => void,
  getReport: (format: AuditFormat) => string,
  copyFormat: AuditFormat,
): {
  body: HTMLElement;
  visSwitch: HTMLButtonElement;
  peekSwitch: HTMLButtonElement;
} {
  const body = document.createElement("div");
  body.className = "ooo-panel-body";

  const visSwitch = addSwitch(body, "vis", "Overlay", onToggleVisible, signal);
  const peekSwitch = addSwitch(
    body,
    "peek",
    "Peek",
    onTogglePeek,
    signal,
  );
  setSwitch(visSwitch, true); // overlay starts shown, peek starts off
  setSwitch(peekSwitch, false);

  const hint = document.createElement("p");
  hint.className = "ooo-panel-hint";
  hint.textContent = `tap ${PEEK_KEY_LABEL[peekKey]} to peek`;
  body.appendChild(hint);

  addCopyButton(body, getReport, copyFormat, signal);

  return { body, visSwitch, peekSwitch };
}

// A split button, GitHub-merge style: the main face copies in the current format;
// the caret opens a menu to switch it. Picking a format only sets it (persisted so
// it survives a same-tab navigation) and relabels the main face - the next main
// click copies in that format.
function addCopyButton(
  parent: HTMLElement,
  getReport: (format: AuditFormat) => string,
  copyFormat: AuditFormat,
  signal: AbortSignal,
): void {
  let current = copyFormat;

  const wrap = document.createElement("div");
  wrap.className = "ooo-copy-split";

  const main = document.createElement("button");
  main.type = "button";
  main.tabIndex = -1;
  main.className = "ooo-copy";

  const caret = document.createElement("button");
  caret.type = "button";
  caret.tabIndex = -1;
  caret.className = "ooo-copy-caret";
  caret.textContent = "▾";
  caret.setAttribute("aria-haspopup", "menu");
  caret.setAttribute("aria-expanded", "false");
  caret.setAttribute("aria-label", "Choose copy format");

  const menu = document.createElement("div");
  menu.className = "ooo-copy-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  const labelFor = (value: AuditFormat): string =>
    COPY_FORMATS.find((format) => format.value === value)?.label ?? value;
  const mainLabel = (): string => `Copy ${labelFor(current).toLowerCase()}`;

  let revert: ReturnType<typeof setTimeout> | undefined;
  const flash = (text: string): void => {
    main.textContent = text;
    clearTimeout(revert);
    revert = setTimeout(() => (main.textContent = mainLabel()), 1200);
  };
  signal.addEventListener("abort", () => clearTimeout(revert));

  const copy = (): void => {
    void navigator.clipboard.writeText(getReport(current)).then(
      () => flash("Copied"),
      () => flash("Copy failed"),
    );
  };

  const closeMenu = (): void => {
    menu.hidden = true;
    caret.setAttribute("aria-expanded", "false");
  };

  const items = new Map<AuditFormat, HTMLButtonElement>();
  const syncSelection = (): void => {
    main.textContent = mainLabel();
    for (const [value, el] of items) {
      el.classList.toggle("ooo-copy-item--on", value === current);
      el.setAttribute("aria-checked", String(value === current));
    }
  };

  for (const format of COPY_FORMATS) {
    const item = document.createElement("button");
    item.type = "button";
    item.tabIndex = -1;
    item.className = "ooo-copy-item";
    item.setAttribute("role", "menuitemradio");
    item.textContent = format.label;
    item.addEventListener("mousedown", (event) => event.preventDefault(), {
      signal,
    });
    item.addEventListener(
      "click",
      () => {
        current = format.value;
        syncSelection();
        patchPanelState({ copyFormat: current });
        closeMenu();
      },
      { signal },
    );
    items.set(format.value, item);
    menu.appendChild(item);
  }
  syncSelection();

  for (const btn of [main, caret]) {
    btn.addEventListener("mousedown", (event) => event.preventDefault(), {
      signal,
    });
  }
  main.addEventListener("click", copy, { signal });
  caret.addEventListener(
    "click",
    () => {
      const open = menu.hidden;
      menu.hidden = !open;
      caret.setAttribute("aria-expanded", String(open));
    },
    { signal },
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!wrap.contains(event.target as Node)) {
        closeMenu();
      }
    },
    { signal },
  );

  wrap.append(main, caret, menu);
  parent.appendChild(wrap);
}

function addSwitch(
  parent: HTMLElement,
  name: string,
  text: string,
  onToggle: () => void,
  signal: AbortSignal,
): HTMLButtonElement {
  const row = document.createElement("div");
  row.className = "ooo-row";

  const lbl = document.createElement("span");
  lbl.className = "ooo-row-label";
  lbl.textContent = text;

  const sw = document.createElement("button");
  sw.type = "button";
  sw.tabIndex = -1;
  sw.className = `ooo-switch ooo-switch--${name}`;
  sw.setAttribute("role", "switch");
  sw.innerHTML = `<span class="ooo-switch-knob"></span>`;
  sw.addEventListener("mousedown", (event) => event.preventDefault(), {
    signal,
  });
  sw.addEventListener("click", onToggle, { signal });

  row.append(lbl, sw);
  parent.appendChild(row);
  return sw;
}

function setSwitch(sw: HTMLButtonElement, on: boolean): void {
  sw.setAttribute("aria-checked", String(on));
  sw.classList.toggle("ooo-switch--on", on);
}

function listenForPeekKey(
  peekKey: ModifierKey,
  signal: AbortSignal,
  onTap: () => void,
): void {
  let armed = false;
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== peekKey) {
        armed = false;
      } else if (!event.repeat) {
        armed = true;
      }
    },
    { signal },
  );

  window.addEventListener(
    "keyup",
    (event) => {
      if (event.key !== peekKey || !armed) {
        return;
      }
      armed = false;
      onTap();
    },
    { signal },
  );

  window.addEventListener("pointerdown", () => (armed = false), { signal });
  window.addEventListener("blur", () => (armed = false), { signal });
}
