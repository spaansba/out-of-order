// Triage chrome for the violations page. Grades every card by the severity of the
// rules it trips, marks each rule tag with its severity, drops the warning-only
// cards to the end of the page, and builds a compact index up top linking to each
// card in that final order.

import { DEFAULT_SEVERITY, type RuleId, type Severity } from "@out-of-order/core";

// The browser focuses the first `autofocus` element during the page's first render, so a
// real attribute in the HTML jumps focus (and scroll) into that card on every load. The
// cards still need it for duplicate-autofocus / autofocus-not-focusable to fire, so the
// HTML ships `data-autofocus` and we promote it to the real attribute. setAttribute on its
// own never triggers focus, but re-inserting an element that already carries `autofocus`
// (e.g. the triage reorder) re-arms that pass, so the caller must run this only once the
// cards are in their final position and the first paint has gone by.
export function restoreAutofocus(): void {
  for (const element of document.querySelectorAll("[data-autofocus]")) {
    element.removeAttribute("data-autofocus");
    element.setAttribute("autofocus", "");
  }
}

const SEV_LABEL: Record<Severity, string> = {
  error: "Errors",
  warning: "Warnings",
};

export function wireTriage(): () => void {
  const content = document.querySelector<HTMLElement>(".content");
  const intro = document.querySelector<HTMLElement>(".intro");
  if (!content || !intro) {
    return () => {};
  }

  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("section.group"),
  );
  // Snapshot each card's authored spot so an HMR dispose can put the page back exactly
  // as written before the module re-runs.
  const home = sections.map((section) => ({
    section,
    parent: section.parentNode as Node,
    next: section.nextSibling,
  }));

  const usedIds = new Set<string>();
  for (const section of sections) {
    section.dataset.severity = gradeSection(section);
    if (section.id) {
      usedIds.add(section.id);
    } else {
      section.id = titleOf(section);
    }
  }

  // Warning-only cards drop to the end, after the error cards (the modal card
  // included), so everything that actually blocks a user reads first.
  for (const section of sections) {
    if (section.dataset.severity === "warning") {
      content.appendChild(section);
    }
  }

  const index = buildIndex();
  intro.after(index);

  // Add the per-heading anchor links after the index is built: titleOf reads the h2's
  // text, so the "#" link must not exist yet or it would leak into the index labels.
  for (const section of sections) {
    addHeaderAnchor(section);
  }

  return () => {
    index.remove();
    // Reinsert each card at its recorded spot, last-to-first so every `next` anchor is
    // already back in place by the time we reference it.
    for (let i = home.length - 1; i >= 0; i--) {
      const { section, parent, next } = home[i]!;
      parent.insertBefore(section, next);
      delete section.dataset.severity;
      section.querySelector(":scope > h2 > .header-anchor")?.remove();
      section
        .querySelectorAll(".rule-tag")
        .forEach((tag) => tag.classList.remove("is-error", "is-warning"));
    }
  };
}

// A hover-reveal anchor beside each indexed heading, the way a docs contents page marks
// its sections.
function addHeaderAnchor(section: HTMLElement): void {
  const heading = section.querySelector<HTMLElement>(":scope > h2");
  if (!heading || heading.querySelector(".header-anchor")) {
    return;
  }
  const anchor = document.createElement("a");
  anchor.className = "header-anchor";
  anchor.href = `#${section.id}`;
  anchor.setAttribute("aria-label", `Link to "${titleOf(section)}"`);
  anchor.textContent = "#";
  heading.appendChild(anchor);
}

// Grade a card from its rule tags, colouring each tag by its own severity. A card is
// an error if any of its rules is an error; otherwise a warning.
function gradeSection(section: Element): Severity {
  let severity: Severity = "warning";
  for (const tag of section.querySelectorAll<HTMLElement>(".rule-tag")) {
    const rule = tag.textContent?.trim() as RuleId | undefined;
    // Built-ins grade from DEFAULT_SEVERITY; a custom rule isn't in it, so fall back to
    // the tag's own data-severity.
    const ruleSeverity =
      (rule ? DEFAULT_SEVERITY[rule] : undefined) ??
      (tag.dataset.severity as Severity | undefined);
    if (!ruleSeverity) {
      continue;
    }
    tag.classList.add(ruleSeverity === "error" ? "is-error" : "is-warning");
    tag.title = ruleSeverity;
    if (ruleSeverity === "error") {
      severity = "error";
    }
  }
  return severity;
}

function buildIndex(): HTMLElement {
  // Re-read in the post-sort DOM order so the index numbers line up with the
  // leading-zero ledger numbers the CSS counter paints down the left margin.
  const ordered = Array.from(
    document.querySelectorAll<HTMLElement>("section.group"),
  );
  const lists: Record<Severity, HTMLOListElement> = {
    error: makeList(),
    warning: makeList(),
  };
  const counts: Record<Severity, number> = { error: 0, warning: 0 };

  ordered.forEach((section, i) => {
    const severity = (section.dataset.severity as Severity) ?? "warning";
    counts[severity]++;
    lists[severity].appendChild(indexItem(section, i + 1, severity));
  });

  const nav = document.createElement("nav");
  nav.className = "index-grid";
  nav.setAttribute("aria-label", "Violations index");
  for (const severity of ["error", "warning"] as Severity[]) {
    if (!counts[severity]) {
      continue;
    }
    const group = document.createElement("div");
    group.className = "index-group";
    const head = document.createElement("span");
    head.className = `index-head is-${severity}`;
    head.textContent = `${SEV_LABEL[severity]} · ${counts[severity]}`;
    group.append(head, lists[severity]);
    nav.appendChild(group);
  }

  // Collapsed by default: a native <details> so the toggle is keyboard-operable and the
  // links inside stay out of the tab order until the reader opens it.
  const details = document.createElement("details");
  details.className = "index";
  const summary = document.createElement("summary");
  summary.className = "index-summary";
  summary.textContent = `Contents · ${ordered.length}`;
  details.append(summary, nav);
  return details;
}

function makeList(): HTMLOListElement {
  const list = document.createElement("ol");
  list.className = "index-list";
  return list;
}

function indexItem(
  section: Element,
  num: number,
  severity: Severity,
): HTMLLIElement {
  const li = document.createElement("li");
  const link = document.createElement("a");
  link.className = `index-link is-${severity}`;
  link.href = `#${section.id}`;

  const numEl = document.createElement("span");
  numEl.className = "index-num";
  numEl.textContent = String(num).padStart(2, "0");

  const titleEl = document.createElement("span");
  titleEl.className = "index-title";
  titleEl.textContent = titleOf(section);

  link.append(numEl, titleEl);
  li.appendChild(link);
  return li;
}

function titleOf(section: Element): string {
  return (
    section.querySelector(":scope > h2")?.textContent?.trim() ?? "violation"
  );
}
