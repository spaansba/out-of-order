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

// Cards sort into the two built-in severities, then a trailing "other" bucket for the
// ones that don't grade on that scale: custom-rule demos and data-ooo-ignore approvals.
type Bucket = Severity | "other";

const SECTION_LABEL: Record<Bucket, string> = {
  error: "Errors",
  warning: "Warnings",
  other: "Other",
};

// Worst-wins when a card carries several tags: an error outranks a warning outranks the
// other bucket.
const RANK: Record<Bucket, number> = { error: 3, warning: 2, other: 1 };

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

  // Warning-only cards drop below the errors (the modal card included), then the "other"
  // cards go dead last, so everything that actually blocks a user reads first.
  for (const bucket of ["warning", "other"]) {
    for (const section of sections) {
      if (section.dataset.severity === bucket) {
        content.appendChild(section);
      }
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
        .forEach((tag) =>
          tag.classList.remove("is-error", "is-warning", "is-approved"),
        );
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

// Grade a card from its rule tags. Each tag gets its own severity pill; the card itself
// buckets to the worst of its tags, and anything without a built-in severity (custom
// rules, a data-ooo-ignore approval) collects under "other".
function gradeSection(section: Element): Bucket {
  let bucket: Bucket | null = null;
  for (const tag of section.querySelectorAll<HTMLElement>(".rule-tag")) {
    const rule = tag.textContent?.trim() as RuleId | undefined;
    const builtin = rule ? DEFAULT_SEVERITY[rule] : undefined;
    // The tag's pill: a built-in's default severity, or a custom/marker tag's declared
    // data-severity (a custom rule's grade, or "approved" for a data-ooo-ignore demo).
    const pill = builtin ?? tag.dataset.severity;
    if (pill) {
      tag.classList.add(`is-${pill}`);
      tag.title = pill;
    }
    const cardBucket: Bucket = builtin ?? "other";
    if (!bucket || RANK[cardBucket] > RANK[bucket]) {
      bucket = cardBucket;
    }
  }
  return bucket ?? "other";
}

function buildIndex(): HTMLElement {
  // Re-read in the post-sort DOM order so the index numbers line up with the
  // leading-zero ledger numbers the CSS counter paints down the left margin.
  const ordered = Array.from(
    document.querySelectorAll<HTMLElement>("section.group"),
  );
  const lists: Record<Bucket, HTMLOListElement> = {
    error: makeList(),
    warning: makeList(),
    other: makeList(),
  };
  const counts: Record<Bucket, number> = { error: 0, warning: 0, other: 0 };

  ordered.forEach((section, i) => {
    const bucket = (section.dataset.severity as Bucket) ?? "other";
    counts[bucket]++;
    lists[bucket].appendChild(indexItem(section, i + 1, bucket));
  });

  const nav = document.createElement("nav");
  nav.className = "index-grid";
  nav.setAttribute("aria-label", "Violations index");
  for (const bucket of ["error", "warning", "other"] as Bucket[]) {
    if (!counts[bucket]) {
      continue;
    }
    const group = document.createElement("div");
    group.className = "index-group";
    const head = document.createElement("span");
    head.className = `index-head is-${bucket}`;
    head.textContent = `${SECTION_LABEL[bucket]} · ${counts[bucket]}`;
    group.append(head, lists[bucket]);
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
  severity: Bucket,
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
