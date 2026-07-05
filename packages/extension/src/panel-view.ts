import { addSwitch, setSwitch } from "@out-of-order/trace";
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
  const signal = new AbortController().signal;
  let overlayOn = initial.overlay;
  let peekOn = initial.peek;
  let motionOn = initial.motion;

  const overlaySwitch = addSwitch(
    container,
    "vis",
    "Overlay",
    () => handlers.onOverlay(!overlayOn),
    signal,
  );
  const peekSwitch = addSwitch(container, "peek", "Peek", () => handlers.onPeek(!peekOn), signal);

  const hint = document.createElement("p");
  hint.className = "ooo-panel-hint";
  hint.textContent = "tap Alt to peek";
  container.appendChild(hint);

  const motionSwitch = addSwitch(
    container,
    "motion",
    "Motion",
    () => {
      motionOn = !motionOn;
      setSwitch(motionSwitch, motionOn);
      handlers.onMotion(motionOn);
    },
    signal,
  );

  const sync = (): void => {
    setSwitch(overlaySwitch, overlayOn);
    setSwitch(peekSwitch, peekOn);
    peekSwitch.disabled = !overlayOn;
  };
  sync();
  setSwitch(motionSwitch, motionOn);

  return {
    syncState(visible, peeking) {
      overlayOn = visible;
      peekOn = peeking;
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

    for (const issue of violation.issues) {
      const row = document.createElement("div");
      row.className = issue.ignored ? "issue issue--ignored" : "issue";

      const head = document.createElement("p");
      head.className = "issue-head";
      const chip = document.createElement("span");
      chip.className = `chip chip--${issue.severity}`;
      chip.textContent = issue.severity;
      head.append(chip);
      const rule = document.createElement(issue.docs ? "a" : "span");
      rule.className = "issue-rule";
      rule.textContent = issue.rule;
      if (issue.docs) {
        const link = rule as HTMLAnchorElement;
        link.href = issue.docs;
        link.target = "_blank";
        link.rel = "noreferrer";
      }
      head.append(rule);
      row.append(head);

      const message = document.createElement("p");
      message.className = "issue-msg";
      message.textContent = issue.message;
      row.append(message);

      if (issue.fix) {
        const fix = document.createElement("p");
        fix.className = "issue-fix";
        const label = document.createElement("span");
        label.className = "issue-fix-label";
        label.textContent = "Possible fix";
        fix.append(label, issue.fix);
        row.append(fix);
      }

      if (issue.ignored) {
        const ignored = document.createElement("p");
        ignored.className = "issue-ignored";
        ignored.textContent = "Ignored via data-ooo-ignore";
        row.append(ignored);
      }

      card.append(row);
    }
    return card;
  }
}
