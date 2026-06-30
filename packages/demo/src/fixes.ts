// Per-section "Solve" buttons for the violations page. Each card plants one bug.
// Its button applies a reversible fix, and because the overlay re-analyzes on DOM
// mutation, that card's badges flip green on their own. Clicking again reverts.
//
// Each fix also captures the element's markup as tokens (the tag plus its
// attributes, with the changed ones flagged). A code snippet under the card shows
// the flagged markup up front, then morphs to the fixed markup on Solve and
// highlights the exact attribute that changed.

import { setModalTrapsFocus } from "./modal.js";

type Attr = { name: string; value: string; changed: boolean };
// body is null for a void element, which renders as just `>`. Otherwise it's the
// inner content shown between the tags: the real text when the child is a plain
// text node, or "…" when the children are elements that can't be shown inline,
// such as an icon. children holds nested tags when a tag wraps others.
type Tag = {
  name: string;
  attrs: Attr[];
  body: string | null;
  children?: Tag[];
};
type Fix = {
  apply: () => void;
  revert: () => void;
  before: Tag[];
  after: Tag[];
};

export function wireSolvers(): () => void {
  const added: Element[] = [];
  const reimpl = buildReimplDemos();
  for (const { anchor, fix } of collectSolvers(reimpl.pairs)) {
    const section = anchor?.closest("section.group");
    if (!section) {
      continue;
    }
    added.push(...addButton(section, fix));
  }
  return () => {
    added.forEach((node) => node.remove());
    reimpl.created.forEach((node) => node.remove());
  };
}

function addButton(section: Element, fix: Fix): Element[] {
  const btn = document.createElement("button");
  btn.className = "btn solve-btn";
  btn.textContent = "Fix";

  // The flagged markup is shown straight away (red) so you can read the bug before
  // fixing it; clicking Solve morphs this same block into the fixed markup (green).
  const box = document.createElement("div");
  box.className = "snippet";
  const head = document.createElement("div");
  head.className = "snippet-head";
  const pre = document.createElement("pre");
  box.append(head, pre);
  const created: Element[] = [btn];
  if (fix.before.length || fix.after.length) {
    const note = section.querySelector("p.note");
    if (note) {
      note.after(box);
      created.push(box);
    }
  }

  let solved = false;
  const render = (): void => {
    box.classList.toggle("after", solved);
    box.classList.toggle("before", !solved);
    head.textContent = solved ? "fixed" : "flagged";
    pre.textContent = "";
    pre.append(renderTags(solved ? fix.after : fix.before, solved));
  };
  render();

  btn.addEventListener("click", () => {
    solved = !solved;
    (solved ? fix.apply : fix.revert)();
    btn.textContent = solved ? "Revert" : "Fix";
    btn.classList.toggle("is-solved", solved);
    render();
    if (solved) {
      pulse(section);
    }
  });
  const heading = section.querySelector(":scope > h2");
  if (heading) {
    heading.after(btn);
  } else {
    section.appendChild(btn);
  }

  return created;
}

// Render the opening tag(s) as DOM nodes. Each changed attribute is wrapped in a
// highlight span (green on the fixed side, red on the flagged side). Everything
// else is appended as plain strings, so the angle brackets and attribute values
// are escaped for free.
function renderTags(tags: Tag[], fixed: boolean): DocumentFragment {
  const frag = document.createDocumentFragment();
  tags.forEach((tag, index) => {
    if (index > 0) {
      frag.append("\n");
    }
    appendTag(frag, tag, fixed, "");
  });
  return frag;
}

function appendTag(
  frag: DocumentFragment,
  tag: Tag,
  fixed: boolean,
  indent: string,
): void {
  frag.append(`${indent}<${tag.name}`);
  for (const attr of tag.attrs) {
    frag.append(" ");
    const text = attr.value === "" ? attr.name : `${attr.name}="${attr.value}"`;
    if (!attr.changed) {
      frag.append(text);
      continue;
    }
    const span = document.createElement("span");
    span.className = fixed ? "hl-add" : "hl-del";
    span.textContent = text;
    frag.append(span);
  }
  if (!tag.children) {
    frag.append(tag.body === null ? ">" : `>${tag.body}</${tag.name}>`);
    return;
  }
  frag.append(">\n");
  for (const child of tag.children) {
    appendTag(frag, child, fixed, indent + "  ");
    frag.append("\n");
  }
  frag.append(`${indent}</${tag.name}>`);
}

function pulse(section: Element): void {
  section.classList.remove("fp-pulse");
  void (section as HTMLElement).offsetWidth; // reflow so re-adding restarts it
  section.classList.add("fp-pulse");
}

function collectSolvers(
  reimplPairs: ReimplPair[],
): { anchor: Element | null; fix: Fix }[] {
  const queryOne = <ElementType extends Element>(selector: string) =>
    document.querySelector(selector) as ElementType | null;
  const qsa = (selector: string) =>
    Array.from(document.querySelectorAll(selector)) as HTMLElement[];

  const scramble = qsa(".scramble input");
  const redundant = qsa(".redundant-tab");
  const toolbar = qsa('[role="toolbar"] button');
  const stacked = queryOne<HTMLElement>("#stacked");
  const hidden = queryOne('#demo div[aria-hidden="true"]');
  const invisible = qsa('[class*="invisible-"]');
  const autofocus = qsa("#autofocus-demo input");
  const nestedLink = queryOne<HTMLElement>(".nested-link");
  const nestedBtn = queryOne<HTMLElement>(".nested-link button");

  return [
    // A · drop every positive tabindex; the DOM order is already correct.
    {
      anchor: scramble[0] ?? null,
      fix: combine(
        ...scramble.map((input) => setAttrs(input, [["tabindex", null]])),
      ),
    },
    // B · reorder the stacked buttons to match their visual top-to-bottom position.
    { anchor: stacked, fix: reorderByTop(stacked) },
    // C · the toolbar already reads Delete→Cut on screen; only the DOM disagrees.
    // Reorder the buttons into their on-screen (left-to-right) order and drop the
    // row-reverse, so the toolbar looks pixel-identical but tab order now follows it.
    {
      anchor: queryOne("#rtl-toolbar"),
      fix: paintInDomOrder(queryOne("#rtl-toolbar")),
    },
    // D · unhide the aria-hidden wrapper.
    { anchor: hidden, fix: setAttrs(hidden, [["aria-hidden", null]]) },
    // E · four ways to be invisible-but-tabbable (opacity:0, zero size, off-screen,
    // clipped). Each is hidden on purpose, so the fix takes it out of the tab order
    // rather than revealing something the author meant to keep hidden.
    {
      anchor: invisible[0] ?? null,
      fix: combine(
        ...invisible.map((input) => setAttrs(input, [["tabindex", "-1"]])),
      ),
    },
    // F · give the icon button an accessible name.
    {
      anchor: queryOne(".icon-btn"),
      fix: setAttrs(queryOne(".icon-btn"), [["aria-label", "Favourite"]]),
    },
    // G · add the clickable div to the tab order.
    {
      anchor: queryOne(".fake-button"),
      fix: setAttrs(queryOne(".fake-button"), [["tabindex", "0"]]),
    },
    // H · roving tabindex: only the first toolbar item stays tabbable. Shown inside
    // its role="toolbar" wrapper, since that role is what makes this a violation.
    {
      anchor: toolbar[0] ?? null,
      fix: within(
        queryOne('[role="toolbar"]'),
        combine(
          ...toolbar.map((btn, index) =>
            setAttrs(btn, [["tabindex", index === 0 ? "0" : "-1"]]),
          ),
        ),
      ),
    },
    // I · remove the dead tabindex from the non-interactive box.
    {
      anchor: queryOne(".dead-stop"),
      fix: setAttrs(queryOne(".dead-stop"), [["tabindex", null]]),
    },
    // O · every control here is already focusable, so its tabindex="0" is a
    // redundant no-op; drop it from each and they stay in the tab order on their
    // own. One combined fix across the whole showcase.
    {
      anchor: redundant[0] ?? null,
      fix: combine(
        ...redundant.map((element) => setAttrs(element, [["tabindex", null]])),
      ),
    },
    // J · the dialog is a real full-page modal that never inerts the page behind
    // it, so focus leaks to every background control. The fix is behavioural (wire
    // the open handler to inert the background), handled in modal.ts.
    { anchor: queryOne("#open-modal"), fix: trapFocusFix() },
    // K · each generic element reimplements a native control; swap them all for the
    // native elements, where focus + keyboard activation + semantics come for free,
    // so the role and tabindex fall away. One combined fix for the whole showcase.
    {
      anchor: reimplPairs[0]?.fake ?? null,
      fix: combine(
        ...reimplPairs.map(({ fake, native }) =>
          useNativeElement(fake, native),
        ),
      ),
    },
    // L · two elements claim autofocus; only the first wins. Drop autofocus from
    // every one after the first.
    { anchor: autofocus[0] ?? null, fix: dropExtraAutofocus(autofocus) },
    // M · autofocus on a non-focusable <div> does nothing. Drop the dead attribute
    // (the alternative, tabindex="-1", would instead make the box focusable).
    {
      anchor: queryOne(".dead-autofocus"),
      fix: setAttrs(queryOne(".dead-autofocus"), [["autofocus", null]]),
    },
    // N · a <button> nested inside an <a href> stacks two tab stops on one spot.
    // Lift the button out so the link and the button become siblings.
    { anchor: nestedLink, fix: unnest(nestedLink, nestedBtn) },
  ];
}

// Card L's fix removes autofocus from every input after the first. The kept first
// input is shown alongside (unchanged) so the snippet makes clear there are two
// and which one is the bug, rather than showing only the edited second input.
function dropExtraAutofocus(inputs: HTMLElement[]): Fix {
  const fix = combine(
    ...inputs.slice(1).map((input) => setAttrs(input, [["autofocus", null]])),
  );
  const first = inputs[0];
  if (!first) {
    return fix;
  }
  const kept = tagOf(first, new Set());
  return { ...fix, before: [kept, ...fix.before], after: [kept, ...fix.after] };
}

type ReimplPair = { fake: HTMLElement; native: HTMLElement };

// A tag-name change, not an attribute edit, so apply/revert just move the live node
// in and out of the DOM; the snippet flags the reimpl's role + tabindex.
function useNativeElement(fake: HTMLElement, native: HTMLElement): Fix {
  return {
    apply: () => fake.replaceWith(native),
    revert: () => native.replaceWith(fake),
    before: [tagOf(fake, new Set(["role", "tabindex"]))],
    after: [tagOf(native, new Set())],
  };
}

// Card N's fix. A structural move, not an attribute edit: the nested control is
// lifted out to sit as the wrapper's sibling, so apply/revert just re-parent the
// live node. The snippet reads as the inner tag un-indenting from inside the
// wrapper (before) to beside it (after), so no attribute is flagged.
function unnest(wrapper: HTMLElement | null, inner: HTMLElement | null): Fix {
  if (!wrapper || !inner) {
    return NOOP;
  }
  const none = new Set<string>();
  const innerTag = tagOf(inner, none);
  // The wrapper as it reads once the control is gone: clone it and drop the inner,
  // so bodyOf sees only the wrapper's own text (still a validly named link).
  const lifted = wrapper.cloneNode(true) as HTMLElement;
  lifted.querySelector(inner.tagName)?.remove();
  return {
    apply: () => wrapper.after(inner),
    revert: () => wrapper.appendChild(inner),
    before: [{ ...tagOf(wrapper, none), body: null, children: [innerTag] }],
    after: [tagOf(lifted, none), innerTag],
  };
}

function make(
  tag: string,
  attrs: Record<string, string>,
  text?: string,
): HTMLElement {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, value);
  }
  if (text != null) {
    element.textContent = text;
  }
  return element;
}

// Mirrors NATIVE_FOR_ROLE in core/dom.ts: one source of truth per role drives both
// the rendered demo and its fix, so they can't drift.
const REIMPL_DEMOS: {
  role: string;
  fake: () => HTMLElement;
  native: () => HTMLElement;
}[] = [
  {
    role: "button",
    fake: () =>
      make(
        "div",
        { class: "demo-btn reimpl-btn", role: "button", tabindex: "0" },
        "Save",
      ),
    native: () => make("button", { class: "demo-btn reimpl-btn" }, "Save"),
  },
  {
    role: "link",
    fake: () =>
      make("span", { class: "demo-link", role: "link", tabindex: "0" }, "Docs"),
    native: () => make("a", { class: "demo-link", href: "#" }, "Docs"),
  },
  {
    role: "checkbox",
    fake: () =>
      make(
        "div",
        {
          class: "reimpl-fake",
          role: "checkbox",
          tabindex: "0",
          "aria-checked": "true",
        },
        "Subscribe",
      ),
    native: () =>
      make("input", {
        type: "checkbox",
        checked: "",
        "aria-label": "Subscribe",
      }),
  },
  {
    role: "radio",
    fake: () =>
      make(
        "div",
        {
          class: "reimpl-fake",
          role: "radio",
          tabindex: "0",
          "aria-checked": "true",
        },
        "Email me",
      ),
    native: () =>
      make("input", { type: "radio", checked: "", "aria-label": "Email me" }),
  },
  {
    role: "switch",
    fake: () =>
      make(
        "div",
        {
          class: "reimpl-fake",
          role: "switch",
          tabindex: "0",
          "aria-checked": "true",
        },
        "Dark mode",
      ),
    native: () =>
      make("input", {
        type: "checkbox",
        role: "switch",
        checked: "",
        "aria-label": "Dark mode",
      }),
  },
  {
    role: "slider",
    fake: () =>
      make(
        "div",
        {
          class: "reimpl-fake",
          role: "slider",
          tabindex: "0",
          "aria-valuenow": "50",
          "aria-valuemin": "0",
          "aria-valuemax": "100",
        },
        "Volume",
      ),
    native: () =>
      make("input", { type: "range", value: "50", "aria-label": "Volume" }),
  },
  {
    role: "spinbutton",
    fake: () =>
      make(
        "div",
        {
          class: "reimpl-fake",
          role: "spinbutton",
          tabindex: "0",
          "aria-valuenow": "1",
        },
        "Quantity",
      ),
    native: () =>
      make("input", { type: "number", value: "1", "aria-label": "Quantity" }),
  },
  {
    role: "searchbox",
    fake: () =>
      make(
        "div",
        { class: "reimpl-fake", role: "searchbox", tabindex: "0" },
        "Search",
      ),
    native: () =>
      make("input", {
        type: "search",
        placeholder: "Search",
        "aria-label": "Search",
      }),
  },
  {
    role: "textbox",
    fake: () =>
      make(
        "div",
        { class: "reimpl-fake", role: "textbox", tabindex: "0" },
        "Name",
      ),
    native: () =>
      make("input", {
        type: "text",
        placeholder: "Name",
        "aria-label": "Name",
      }),
  },
  {
    role: "combobox",
    fake: () =>
      make(
        "div",
        { class: "reimpl-fake", role: "combobox", tabindex: "0" },
        "Country",
      ),
    native: () => {
      const select = make("select", { "aria-label": "Country" });
      for (const name of ["United States", "Netherlands", "Japan"]) {
        select.appendChild(make("option", {}, name));
      }
      return select;
    },
  },
  {
    role: "option",
    fake: () =>
      make(
        "div",
        { class: "reimpl-fake", role: "option", tabindex: "0" },
        "Option A",
      ),
    native: () => make("option", {}, "Option A"),
  },
];

// Render one labelled cell per role into the showcase. Returns the fake/native pairs
// (for the combined fix) and the created nodes (so wireSolvers can tear them down).
function buildReimplDemos(): { pairs: ReimplPair[]; created: Element[] } {
  const host = document.querySelector("#reimpl-demo");
  if (!host) {
    return { pairs: [], created: [] };
  }
  const pairs: ReimplPair[] = [];
  const created: Element[] = [];
  for (const demo of REIMPL_DEMOS) {
    const fake = demo.fake();
    const cell = make("div", { class: "reimpl-cell" });
    cell.appendChild(
      make("code", { class: "reimpl-role" }, `role="${demo.role}"`),
    );
    cell.appendChild(fake);
    host.appendChild(cell);
    created.push(cell);
    pairs.push({ fake, native: demo.native() });
  }
  return { pairs, created };
}

// J's fix isn't a static attribute edit but a behavioural one: the modal's open
// handler is wired to make the page behind it inert (see modal.ts). The snippet
// illustrates the effect - inert landing on the page's main content while open.
function trapFocusFix(): Fix {
  return {
    apply: () => setModalTrapsFocus(true),
    revert: () => setModalTrapsFocus(false),
    before: [{ name: "main", attrs: [], body: "…" }],
    after: [
      {
        name: "main",
        attrs: [{ name: "inert", value: "", changed: true }],
        body: "…",
      },
    ],
  };
}

const NOOP: Fix = { apply: () => {}, revert: () => {}, before: [], after: [] };

// A fix that rewrites one or more attributes on a single element. The flagged tag
// is read from the live element; the fixed tag from a deep clone (deep so its body
// survives in the snippet), so the DOM isn't touched until `apply`. An attribute is
// flagged "changed" on the side where its presence/value differs (removed → flagged
// side, added → fixed side, both for a value change).
function setAttrs(
  element: Element | null,
  edits: [name: string, value: string | null][],
): Fix {
  if (!element) {
    return NOOP;
  }
  const originals = edits.map(
    ([name]) => [name, element.getAttribute(name)] as const,
  );
  const clone = element.cloneNode(true) as Element;
  for (const [name, value] of edits) {
    writeAttr(clone, name, value);
  }

  const beforeChanged = new Set(
    edits
      .filter(
        ([name, value]) =>
          element.getAttribute(name) !== null &&
          element.getAttribute(name) !== value,
      )
      .map(([name]) => name),
  );
  const afterChanged = new Set(
    edits
      .filter(
        ([name, value]) =>
          value !== null && element.getAttribute(name) !== value,
      )
      .map(([name]) => name),
  );
  return {
    apply: () =>
      edits.forEach(([name, value]) => writeAttr(element, name, value)),
    revert: () =>
      originals.forEach(([name, value]) => writeAttr(element, name, value)),
    before: [tagOf(element, beforeChanged)],
    after: [tagOf(clone, afterChanged)],
  };
}

// Card C's reorder. Like reorderByTop but for a flex row: the buttons are sorted
// into their visual left-to-right order and the container is switched from
// row-reverse to a plain left-aligned row, so the new DOM order paints exactly what
// was already on screen — the toolbar is pixel-identical, but tab order now matches
// it. The snippet shows the container with its children so both halves read: the
// style normalising (row-reverse → row) and the buttons resequencing beneath it.
function paintInDomOrder(toolbar: HTMLElement | null): Fix {
  if (!toolbar) {
    return NOOP;
  }
  const items = Array.from(toolbar.children) as HTMLElement[];
  const original = items.slice();
  const sorted = [...items].sort(
    (first, second) =>
      first.getBoundingClientRect().left - second.getBoundingClientRect().left,
  );
  const styleEdits: [string, string][] = [
    ["flex-direction", "row"],
    ["justify-content", "flex-start"],
  ];
  const originalStyles = styleEdits.map(
    ([prop]) => [prop, toolbar.style.getPropertyValue(prop)] as const,
  );

  // Attrs-only clone (no children) carrying the fixed style, so the "after" tag
  // shows the normalised style without touching the live DOM until apply().
  const fixedTag = toolbar.cloneNode(false) as HTMLElement;
  styleEdits.forEach(([prop, value]) =>
    fixedTag.style.setProperty(prop, value),
  );

  const none = new Set<string>();
  const wrap = (container: HTMLElement, kids: HTMLElement[]): Tag => ({
    ...tagOf(container, new Set(["style"])),
    body: null,
    children: kids.map((element) => tagOf(element, none)),
  });

  return {
    apply: () => {
      styleEdits.forEach(([prop, value]) =>
        toolbar.style.setProperty(prop, value),
      );
      sorted.forEach((element) => toolbar.appendChild(element));
    },
    revert: () => {
      originalStyles.forEach(([prop, value]) =>
        value
          ? toolbar.style.setProperty(prop, value)
          : toolbar.style.removeProperty(prop),
      );
      original.forEach((element) => toolbar.appendChild(element));
    },
    before: [wrap(toolbar, original)],
    after: [wrap(fixedTag, sorted)],
  };
}

function reorderByTop(stack: HTMLElement | null): Fix {
  if (!stack) {
    return NOOP;
  }
  const items = Array.from(stack.children) as HTMLElement[];
  const original = items.slice();
  const sorted = [...items].sort(
    (first, second) =>
      parseFloat(first.style.top) - parseFloat(second.style.top),
  );
  // A reorder changes no attributes; the fix reads as the line order flipping.
  const none = new Set<string>();
  const tags = (els: HTMLElement[]) =>
    els.map((element) => tagOf(element, none));
  return {
    apply: () => sorted.forEach((element) => stack.appendChild(element)),
    revert: () => original.forEach((element) => stack.appendChild(element)),
    before: tags(items),
    after: tags(sorted),
  };
}

function combine(...fixes: Fix[]): Fix {
  return {
    apply: () => fixes.forEach((fix) => fix.apply()),
    revert: () => fixes.forEach((fix) => fix.revert()),
    before: fixes.flatMap((fix) => fix.before),
    after: fixes.flatMap((fix) => fix.after),
  };
}

// Nest a fix's tags inside their container element, so the snippet shows the
// context that makes the change necessary (for case I, the role="toolbar" wrapper).
// The container itself doesn't change, so none of its attributes are flagged.
function within(container: Element | null, fix: Fix): Fix {
  if (!container) {
    return fix;
  }
  const nest = (kids: Tag[]): Tag[] => [
    { ...tagOf(container, new Set()), body: null, children: kids },
  ];
  return { ...fix, before: nest(fix.before), after: nest(fix.after) };
}

// Snapshot an element's opening tag as tokens. The class attribute is dropped
// entirely: it never affects the tab order, and it also carries the overlay's own
// injected classes (fp-ring …) as noise, so it only distracts from the fix.
function tagOf(element: Element, changed: Set<string>): Tag {
  const attrs: Attr[] = [];
  for (const attr of Array.from(element.attributes)) {
    if (attr.name === "class") {
      continue;
    }
    attrs.push({
      name: attr.name,
      value: attr.value,
      changed: changed.has(attr.name),
    });
  }
  return { name: element.tagName.toLowerCase(), attrs, body: bodyOf(element) };
}

function bodyOf(element: Element): string | null {
  if (element.childNodes.length === 0) {
    return null; // nothing inside (e.g. <input>)
  }
  if (element.children.length > 0) {
    return "…"; // element children can't be shown inline
  }
  return element.textContent?.replace(/\s+/g, " ").trim() || "…";
}

function writeAttr(element: Element, name: string, value: string | null): void {
  if (value === null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
}
