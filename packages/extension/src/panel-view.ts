import type { AuditSnapshot } from "./protocol.js";

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

export function renderIdle(container: HTMLElement): void {
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Waiting for a page to audit.";
  container.replaceChildren(hint);
}

export function renderSnapshot(
  container: HTMLElement,
  snapshot: AuditSnapshot,
  onFocus: (index: number) => void,
): void {
  const summary = document.createElement("p");
  summary.className = "summary";
  const stops = `${snapshot.stopCount} tab ${snapshot.stopCount === 1 ? "stop" : "stops"}`;
  if (snapshot.violations.length === 0) {
    summary.classList.add("summary--ok");
    summary.textContent = `No tab-order issues. ${stops}.`;
    container.replaceChildren(summary);
    return;
  }
  const elements = `${snapshot.violations.length} ${snapshot.violations.length === 1 ? "element" : "elements"}`;
  summary.textContent = `${stops}, ${elements} with issues.`;
  container.replaceChildren(summary, ...snapshot.violations.map(buildFinding));

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
      if (issue.docs) {
        const rule = document.createElement("a");
        rule.className = "issue-rule";
        rule.href = issue.docs;
        rule.target = "_blank";
        rule.rel = "noreferrer";
        rule.textContent = issue.rule;
        head.append(rule);
      } else {
        const rule = document.createElement("span");
        rule.className = "issue-rule";
        rule.textContent = issue.rule;
        head.append(rule);
      }
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
