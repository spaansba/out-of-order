import { AUDIT_FORMATS, type AuditFormat } from "@out-of-order/core";

export type ModifierKey = "Alt" | "Control" | "Shift" | "Meta";

const formatLabel = (format: AuditFormat): string => {
  const spaced = format.replace("-", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const PEEK_KEY_LABEL: Record<ModifierKey, string> = {
  Alt: "Alt",
  Control: "Ctrl",
  Shift: "Shift",
  Meta: "Meta",
};

interface ControlsOptions {
  peekKey: ModifierKey;
  open: boolean;
  copyFormat: AuditFormat;
  onToggleVisible: () => void;
  onTogglePeek: () => void;
  onToggleOpen: (open: boolean) => void;
  onCopyFormat: (format: AuditFormat) => void;
  getReport: (format: AuditFormat) => string;
}

interface Controls {
  syncVisible(shown: boolean): void;
  syncPeek(on: boolean): void;
  teardown(): void;
}

/** The panel-less variant: no UI, but the peek key keeps working. */
export function headlessControls(peekKey: ModifierKey, onTogglePeek: () => void): Controls {
  const abort = new AbortController();
  listenForPeekKey(peekKey, abort.signal, onTogglePeek);
  return {
    syncVisible: () => {},
    syncPeek: () => {},
    teardown: () => abort.abort(),
  };
}

export function setupControls(layer: HTMLElement, opts: ControlsOptions): Controls {
  const abort = new AbortController();
  const signal = abort.signal;

  const panel = document.createElement("div");
  panel.className = "ooo-panel";
  panel.dataset.open = opts.open ? "1" : "0";

  const title = buildTitle(panel, signal, opts.onToggleOpen);
  const { body, visSwitch, peekSwitch } = buildBody(opts, signal);
  panel.append(title, body);
  layer.appendChild(panel);

  listenForPeekKey(opts.peekKey, signal, opts.onTogglePeek);

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
  opts: ControlsOptions,
  signal: AbortSignal,
): {
  body: HTMLElement;
  visSwitch: HTMLButtonElement;
  peekSwitch: HTMLButtonElement;
} {
  const body = document.createElement("div");
  body.className = "ooo-panel-body";

  const visSwitch = addSwitch(body, "vis", "Overlay", opts.onToggleVisible, signal);
  const peekSwitch = addSwitch(body, "peek", "Peek", opts.onTogglePeek, signal);
  setSwitch(visSwitch, true); // overlay starts shown, peek starts off
  setSwitch(peekSwitch, false);

  const hint = document.createElement("p");
  hint.className = "ooo-panel-hint";
  hint.textContent = `tap ${PEEK_KEY_LABEL[opts.peekKey]} to peek`;
  body.appendChild(hint);

  addCopySplit(
    body,
    { format: opts.copyFormat, onFormat: opts.onCopyFormat, getReport: opts.getReport },
    signal,
  );

  return { body, visSwitch, peekSwitch };
}

export interface CopySplitOptions {
  format?: AuditFormat;
  onFormat?: (format: AuditFormat) => void;
  getReport: (format: AuditFormat) => string | Promise<string>;
}

// A split button, GitHub-merge style: the main face copies in the current format;
// the caret opens a menu to switch it. Picking a format only sets it and relabels
// the main face - the next main click copies in that format.
export function addCopySplit(
  parent: HTMLElement,
  opts: CopySplitOptions,
  signal?: AbortSignal,
): void {
  let current = opts.format ?? "by-element";

  const wrap = document.createElement("div");
  wrap.className = "ooo-copy-split";

  const main = document.createElement("button");
  main.type = "button";
  main.className = "ooo-copy";

  const caret = document.createElement("button");
  caret.type = "button";
  caret.className = "ooo-copy-caret";
  caret.textContent = "▾";
  caret.setAttribute("aria-haspopup", "menu");
  caret.setAttribute("aria-expanded", "false");
  caret.setAttribute("aria-label", "Choose copy format");

  const menu = document.createElement("div");
  menu.className = "ooo-copy-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Copy format");
  menu.hidden = true;

  const mainLabel = (): string => {
    const label = formatLabel(current).toLowerCase();
    return label.startsWith("by ") ? `Copy ${label}` : `Copy as ${label}`;
  };

  let revert: ReturnType<typeof setTimeout> | undefined;
  const flash = (text: string): void => {
    main.textContent = text;
    clearTimeout(revert);
    revert = setTimeout(() => (main.textContent = mainLabel()), 1200);
  };
  signal?.addEventListener("abort", () => clearTimeout(revert));

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(await opts.getReport(current));
      flash("Copied");
    } catch {
      flash("Copy failed");
    }
  };

  const closeMenu = (refocus = false): void => {
    menu.hidden = true;
    caret.setAttribute("aria-expanded", "false");
    if (refocus) {
      caret.focus();
    }
  };

  const itemButtons: HTMLButtonElement[] = [];
  const selectedIndex = (): number => AUDIT_FORMATS.findIndex((f) => f === current);
  const openMenu = (focusIdx?: number): void => {
    menu.hidden = false;
    caret.setAttribute("aria-expanded", "true");
    if (focusIdx !== undefined) {
      itemButtons[focusIdx]?.focus();
    }
  };

  const items = new Map<AuditFormat, HTMLButtonElement>();
  const syncSelection = (): void => {
    main.textContent = mainLabel();
    for (const [value, el] of items) {
      el.classList.toggle("ooo-copy-item--on", value === current);
      el.setAttribute("aria-checked", String(value === current));
    }
  };

  for (const format of AUDIT_FORMATS) {
    const item = document.createElement("button");
    item.type = "button";
    // Roving focus, per the ARIA menu pattern (and our own composite-roving-tabindex
    // rule): the menu adds no tab stops of its own; the arrow keys move between items.
    item.tabIndex = -1;
    item.className = "ooo-copy-item";
    item.setAttribute("role", "menuitemradio");
    item.textContent = formatLabel(format);
    item.addEventListener("mousedown", (event) => event.preventDefault(), {
      signal,
    });
    item.addEventListener(
      "click",
      (event) => {
        current = format;
        syncSelection();
        opts.onFormat?.(current);
        // detail 0 → keyboard activation: hand focus back to the caret. A mouse
        // click never took it (mousedown is prevented), so leave it alone.
        closeMenu(event.detail === 0);
      },
      { signal },
    );
    items.set(format, item);
    itemButtons.push(item);
    menu.appendChild(item);
  }
  syncSelection();

  menu.addEventListener(
    "keydown",
    (event) => {
      const idx = itemButtons.indexOf(document.activeElement as HTMLButtonElement);
      const last = itemButtons.length - 1;
      if (event.key === "Escape") {
        closeMenu(true);
      } else if (event.key === "Tab") {
        // Close and put focus back on the caret so the un-prevented Tab leaves
        // from there, not from a now-hidden item.
        closeMenu(true);
        return;
      } else if (event.key === "ArrowDown") {
        itemButtons[idx >= last ? 0 : idx + 1]?.focus();
      } else if (event.key === "ArrowUp") {
        itemButtons[idx <= 0 ? last : idx - 1]?.focus();
      } else if (event.key === "Home") {
        itemButtons[0]?.focus();
      } else if (event.key === "End") {
        itemButtons[last]?.focus();
      } else {
        return;
      }
      event.preventDefault();
    },
    { signal },
  );

  for (const btn of [main, caret]) {
    btn.addEventListener("mousedown", (event) => event.preventDefault(), {
      signal,
    });
  }
  main.addEventListener("click", () => void copy(), { signal });
  caret.addEventListener(
    "click",
    (event) => {
      if (!menu.hidden) {
        closeMenu();
        return;
      }
      // detail 0 → keyboard (Enter/Space): move focus onto the checked item, the
      // menu-button pattern's cue that the arrows now navigate. Mouse users keep
      // their focus where it was.
      openMenu(event.detail === 0 ? selectedIndex() : undefined);
    },
    { signal },
  );
  caret.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }
      event.preventDefault();
      openMenu(selectedIndex());
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

export function addSwitch(
  parent: HTMLElement,
  name: string,
  text: string,
  onToggle: () => void,
  signal?: AbortSignal,
): HTMLButtonElement {
  const row = document.createElement("div");
  row.className = "ooo-row";

  const lbl = document.createElement("span");
  lbl.className = "ooo-row-label";
  lbl.textContent = text;

  const sw = document.createElement("button");
  sw.type = "button";
  sw.className = `ooo-switch ooo-switch--${name}`;
  sw.setAttribute("role", "switch");
  // The visible label is a sibling span, invisible to the accessibility tree.
  sw.setAttribute("aria-label", text);
  const knob = document.createElement("span");
  knob.className = "ooo-switch-knob";
  sw.append(knob);
  sw.addEventListener("mousedown", (event) => event.preventDefault(), {
    signal,
  });
  sw.addEventListener("click", onToggle, { signal });

  row.append(lbl, sw);
  parent.appendChild(row);
  return sw;
}

export function setSwitch(sw: HTMLButtonElement, on: boolean): void {
  sw.setAttribute("aria-checked", String(on));
  sw.classList.toggle("ooo-switch--on", on);
}

export function listenForPeekKey(
  peekKey: ModifierKey,
  signal: AbortSignal | undefined,
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
