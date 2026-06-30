import type { ModifierKey } from "./index.js";

const PEEK_KEY_LABEL: Record<ModifierKey, string> = {
  Alt: "Alt",
  Control: "Ctrl",
  Shift: "Shift",
  Meta: "Meta",
};

const PANEL_STATE_KEY = "focuspocus:reveal";

export interface PanelState {
  visible: boolean;
  peek: boolean;
  open: boolean;
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

export interface ControlsOptions {
  peekKey: ModifierKey;
  open: boolean;
  onToggleVisible: () => void;
  onTogglePeek: () => void;
  onToggleOpen: (open: boolean) => void;
}

export interface Controls {
  syncVisible(shown: boolean): void;
  syncPeek(on: boolean): void;
  teardown(): void;
}

export function setupControls(
  layer: HTMLElement,
  opts: ControlsOptions,
): Controls {
  const { peekKey, open, onToggleVisible, onTogglePeek, onToggleOpen } = opts;
  const abort = new AbortController();
  const signal = abort.signal;

  const panel = document.createElement("div");
  panel.className = "fp-panel";
  panel.dataset.open = open ? "1" : "0";

  const title = buildTitle(panel, signal, onToggleOpen);
  const { body, visSwitch, peekSwitch } = buildBody(
    peekKey,
    signal,
    onToggleVisible,
    onTogglePeek,
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
  title.className = "fp-panel-title";
  title.textContent = "Focus Pocus";

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
): {
  body: HTMLElement;
  visSwitch: HTMLButtonElement;
  peekSwitch: HTMLButtonElement;
} {
  const body = document.createElement("div");
  body.className = "fp-panel-body";

  const visSwitch = addSwitch(body, "vis", "Overlay", onToggleVisible, signal);
  const peekSwitch = addSwitch(
    body,
    "peek",
    "Click-through",
    onTogglePeek,
    signal,
  );
  setSwitch(visSwitch, true); // overlay starts shown, peek starts off
  setSwitch(peekSwitch, false);

  const hint = document.createElement("p");
  hint.className = "fp-panel-hint";
  hint.textContent = `tap ${PEEK_KEY_LABEL[peekKey]} to peek`;
  body.appendChild(hint);

  return { body, visSwitch, peekSwitch };
}

function addSwitch(
  parent: HTMLElement,
  name: string,
  text: string,
  onToggle: () => void,
  signal: AbortSignal,
): HTMLButtonElement {
  const row = document.createElement("div");
  row.className = "fp-row";

  const lbl = document.createElement("span");
  lbl.className = "fp-row-label";
  lbl.textContent = text;

  const sw = document.createElement("button");
  sw.type = "button";
  sw.tabIndex = -1;
  sw.className = `fp-switch fp-switch--${name}`;
  sw.setAttribute("role", "switch");
  sw.innerHTML = `<span class="fp-switch-knob"></span>`;
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
  sw.classList.toggle("fp-switch--on", on);
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
