import { addSwitch, issueHtml, setSwitch } from "@out-of-order/trace";
import type { AuditSnapshot, OverlaySettings } from "./protocol.js";

export type StatusKind = "info" | "error";

export function renderStatus(banner: HTMLElement, kind: StatusKind | null, text = ""): void {
  banner.hidden = kind === null;
  banner.textContent = text;
  if (kind) {
    banner.dataset.kind = kind;
  } else {
    delete banner.dataset.kind;
  }
}

export interface SettingsHandlers {
  onOverlay: (on: boolean) => void;
  onPeek: (on: boolean) => void;
  onMotion: (on: boolean) => void;
}

export interface SettingsView {
  syncState(visible: boolean, peeking: boolean): void;
}

export function buildSettings(
  container: HTMLElement,
  initial: OverlaySettings,
  handlers: SettingsHandlers,
): SettingsView {
  const state = { ...initial };

  const overlaySwitch = addSwitch(container, "vis", "Overlay", () =>
    handlers.onOverlay(!state.overlay),
  );
  const peekSwitch = addSwitch(container, "peek", "Peek", () => handlers.onPeek(!state.peek));

  const hint = document.createElement("p");
  hint.className = "ooo-panel-hint";
  hint.textContent = "tap Alt to peek";
  container.appendChild(hint);

  // Motion never round-trips back through syncState, so its handler owns the flip.
  const motionSwitch = addSwitch(container, "motion", "Motion", () => {
    state.motion = !state.motion;
    sync();
    handlers.onMotion(state.motion);
  });

  const sync = (): void => {
    setSwitch(overlaySwitch, state.overlay);
    setSwitch(peekSwitch, state.peek);
    setSwitch(motionSwitch, state.motion);
    peekSwitch.disabled = !state.overlay;
  };
  sync();

  return {
    syncState(visible, peeking) {
      state.overlay = visible;
      state.peek = peeking;
      sync();
    },
  };
}

export function renderSnapshot(
  container: HTMLElement,
  snapshot: AuditSnapshot,
  onFocus: (index: number) => void,
): HTMLElement[] {
  const summary = document.createElement("p");
  summary.className = "summary";
  const stops = `${snapshot.stopCount} tab ${snapshot.stopCount === 1 ? "stop" : "stops"}`;
  if (snapshot.violations.length === 0) {
    summary.classList.add("summary--ok");
    summary.textContent = `No tab-order issues. ${stops}.`;
    container.replaceChildren(summary);
    return [];
  }
  const elements = `${snapshot.violations.length} ${snapshot.violations.length === 1 ? "element" : "elements"}`;
  summary.textContent = `${stops}, ${elements} with issues.`;
  const cards = snapshot.violations.map(buildFinding);
  container.replaceChildren(summary, ...cards);

  return cards;

  function buildFinding(
    violation: AuditSnapshot["violations"][number],
    index: number,
  ): HTMLElement {
    const card = document.createElement("article");
    card.className = "finding";

    const locate = document.createElement("button");
    locate.type = "button";
    locate.className = "finding-selector";
    locate.title = "Scroll to this element on the page";
    if (violation.orderIndex !== undefined) {
      const order = document.createElement("span");
      order.className = "finding-order";
      order.textContent = `#${violation.orderIndex + 1}`;
      locate.append(order);
    }
    const selector = document.createElement("span");
    selector.className = "finding-path";
    selector.textContent = violation.selector;
    locate.append(selector);
    locate.addEventListener("click", () => onFocus(index));
    card.append(locate);

    card.insertAdjacentHTML("beforeend", violation.issues.map(issueHtml).join(""));
    return card;
  }
}
