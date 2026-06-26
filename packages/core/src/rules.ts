import { computeAccessibleName } from "dom-accessibility-api";
import { isFocusable } from "tabbable";
import type { RuleId, SequenceEntry, Severity, Violation } from "./types.js";
import {
  isInteractive,
  hasExplicitName,
  selectorFor,
  hiddenReason,
  inAriaHidden,
  isInert,
  looksClickable,
  isFocusManaged,
  compositeAncestor,
  floatingAncestor,
  scrollAncestor,
  isScrollContainer,
  openModal,
  nativeReplacement,
  isNativelyFocusable,
} from "./dom.js";

/** Spec link each rule is grounded in, carried on every violation (via
    `entryViolation`) so a finding cites its authority. WCAG 2.2 "Understanding",
    WAI-ARIA 1.2, or the ARIA APG. */
export const RULE_DOCS: Record<RuleId, string> = {
  "no-positive-tabindex":
    "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
  "visual-order-mismatch":
    "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
  "missing-accessible-name":
    "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  "aria-hidden-focusable": "https://www.w3.org/TR/wai-aria-1.2/#aria-hidden",
  "hidden-while-focusable":
    "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
  "clickable-not-focusable":
    "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
  "composite-roving-tabindex":
    "https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/",
  "focus-escapes-modal":
    "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/",
  "tabindex-on-noninteractive":
    "https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/",
  "prefer-native-element": "https://www.w3.org/TR/using-aria/#firstrule",
  "duplicate-autofocus":
    "https://html.spec.whatwg.org/multipage/interaction.html#the-autofocus-attribute",
  "autofocus-not-focusable":
    "https://html.spec.whatwg.org/multipage/interaction.html#the-autofocus-attribute",
  "nested-interactive":
    "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  "redundant-tabindex":
    "https://html.spec.whatwg.org/multipage/interaction.html#attr-tabindex",
};

/** The severity each rule fires at unless the caller overrides it via
    `AnalyzeOptions.rules`. `error` = a real barrier (unreachable, unannounced,
    invisible, trapped); `warning` = dead/no-op markup or a best-practice nit that
    doesn't block a keyboard or screen-reader user. */
export const DEFAULT_SEVERITY: Record<RuleId, Severity> = {
  "no-positive-tabindex": "error",
  "visual-order-mismatch": "warning",
  "missing-accessible-name": "error",
  "aria-hidden-focusable": "error",
  "hidden-while-focusable": "error",
  "clickable-not-focusable": "error",
  "composite-roving-tabindex": "warning",
  "focus-escapes-modal": "error",
  "tabindex-on-noninteractive": "error",
  "prefer-native-element": "warning",
  "duplicate-autofocus": "warning",
  "autofocus-not-focusable": "warning",
  "nested-interactive": "error",
  "redundant-tabindex": "warning",
};

/** px tolerance for treating two stops as the same visual row. Elements on one row
    rarely share an exact vertical center (height/padding/baseline differ), and below
    ~8px a sighted user doesn't perceive a row break. */
const ROW_TOLERANCE_PX = 8;

/** Everything a rule may need beyond the sequence itself. */
export interface RuleContext {
  /** The analyzed root element (lets rules look beyond the tab sequence). */
  container: Element;
  /** Fast membership test: is this element one of the tab stops? */
  inSequence: Set<Element>;
}

/** A rule's output before grading: a Violation minus its `severity`, which
    `analyzeTabOrder` stamps on from `DEFAULT_SEVERITY` (or the caller's override).
    Keeping severity out of the rules means a rule never has to know how serious it
    is, and a re-grade lives in exactly one place. */
export type Finding = Omit<Violation, "severity">;

/** Takes the computed tab sequence (plus context) and returns any findings. Pure. */
export type Rule = (sequence: SequenceEntry[], ctx: RuleContext) => Finding[];

function entryViolation(
  rule: RuleId,
  entry: SequenceEntry,
  message: string,
): Finding {
  return {
    rule,
    message,
    docs: RULE_DOCS[rule],
    element: entry.element,
    selector: entry.selector,
    orderIndex: entry.orderIndex,
  };
}

export const noPositiveTabIndex: Rule = (sequence) => {
  const out: Finding[] = [];
  for (const entry of sequence) {
    if (entry.tabIndex <= 0) {
      continue;
    }

    out.push(
      entryViolation(
        "no-positive-tabindex",
        entry,
        `Element has tabindex="${entry.tabIndex}". Positive tabindex overrides the natural DOM order and is fragile; use 0 or restructure the DOM.`,
      ),
    );
  }

  return out;
};

/**
 * The tab sequence should match the visual reading order (top→bottom,
 * left→right). A mismatch is local: it happens between two consecutive tab
 * stops when the second one sits visually *before* the first (an earlier row,
 * or the same row but to its left), i.e. Tab makes a backward hop.
 */
export const visualOrderMismatch: Rule = (sequence) => {
  // Each element's floating ancestor, computed once (it walks the tree calling
  // getComputedStyle); the adjacent-pair loop below would otherwise recompute
  // every element's twice, as the "cur" of one pair and the "prev" of the next.
  const floats = sequence.map((entry) => floatingAncestor(entry.element));
  const scrollers = sequence.map((entry) => scrollAncestor(entry.element));
  const out: Finding[] = [];
  for (let idx = 1; idx < sequence.length; idx++) {
    const prev = sequence[idx - 1]!;
    const cur = sequence[idx]!;
    // Only compare stops that share a scroll context. If they ride different
    // fixed/sticky layers (page chrome floating over scrolling content), or
    // different scroll containers (one inside an overflow:auto/scroll box, the
    // other outside, or in separate boxes), then their up/down/left/right
    // relationship moves with a scrollbar, so a "backward hop" between them isn't
    // real. Skip the pair.
    if (
      floats[idx - 1] !== floats[idx] ||
      scrollers[idx - 1] !== scrollers[idx]
    ) {
      continue;
    }

    const prevY = prev.rect.top + prev.rect.height / 2;
    const curY = cur.rect.top + cur.rect.height / 2;
    const prevX = prev.rect.left + prev.rect.width / 2;
    const curX = cur.rect.left + cur.rect.width / 2;
    // Backward hop: the element reached is on an earlier row, or on the same
    // row but to the left of the one we came from.
    const earlierRow = curY < prevY - ROW_TOLERANCE_PX;
    const sameRow = Math.abs(curY - prevY) <= ROW_TOLERANCE_PX;
    const backwardHop = earlierRow || (sameRow && curX < prevX - 1);
    if (!backwardHop) {
      continue;
    }

    out.push(
      entryViolation(
        "visual-order-mismatch",
        cur,
        `"${cur.selector}" comes after "${prev.selector}" in the tab order, but sits visually before it (reading order is top→bottom, left→right). Tab makes a backward hop here.`,
      ),
    );
  }

  return out;
};

/** Focusable interactive elements must expose an accessible name. */
export const missingAccessibleName: Rule = (sequence) => {
  const out: Finding[] = [];
  for (const entry of sequence) {
    if (!isInteractive(entry.element)) {
      continue;
    }

    // Skip the costly subtree walk when a name is already guaranteed.
    if (hasExplicitName(entry.element)) {
      continue;
    }

    if (computeAccessibleName(entry.element).trim() !== "") {
      continue;
    }

    out.push(
      entryViolation(
        "missing-accessible-name",
        entry,
        `Focusable element "${entry.selector}" has no accessible name (no text, aria-label, aria-labelledby, associated label, alt, or title).`,
      ),
    );
  }

  return out;
};

/** aria-hidden hides from the a11y tree but NOT from the tab order: a keyboard +
    screen-reader user focuses a control their SR refuses to announce. */
export const ariaHiddenFocusable: Rule = (sequence) => {
  const out: Finding[] = [];
  for (const entry of sequence) {
    if (!inAriaHidden(entry.element)) {
      continue;
    }

    out.push(
      entryViolation(
        "aria-hidden-focusable",
        entry,
        `"${entry.selector}" is tabbable but inside aria-hidden="true", so a screen-reader user lands on a control the SR won't announce. Add tabindex="-1"/inert, or remove aria-hidden.`,
      ),
    );
  }

  return out;
};

/** In the tab order but invisible: opacity:0, zero size, off-screen, or clipped.
    The user can tab to something they can't see. */
export const hiddenWhileFocusable: Rule = (sequence) => {
  const out: Finding[] = [];
  for (const entry of sequence) {
    const reason = hiddenReason(entry.element, entry.rect);

    if (!reason) {
      continue;
    }

    out.push(
      entryViolation(
        "hidden-while-focusable",
        entry,
        `"${entry.selector}" is tabbable but ${reason}. Hide it from the tab order too (display:none, the hidden attribute, or tabindex="-1").`,
      ),
    );
  }
  return out;
};

/** Something interactive to the mouse (role/onclick) that the
    keyboard can never reach because it isn't focusable. */
export const clickableNotFocusable: Rule = (
  _sequence,
  { container, inSequence },
) => {
  // Every ancestor-or-self of a tab stop, collected once. A clickable element
  // that's in this set merely wraps a real focusable control, so the keyboard
  // can still get in, so skip it.
  const wrapsFocusable = new Set<Element>();
  for (const stop of inSequence) {
    for (let node: Element | null = stop; node; node = node.parentElement) {
      if (wrapsFocusable.has(node)) {
        break;
      }
      wrapsFocusable.add(node);
    }
  }

  const out: Finding[] = [];
  for (const element of container.querySelectorAll("*")) {
    if (inSequence.has(element)) {
      continue;
    }

    if (wrapsFocusable.has(element)) {
      continue;
    }

    if (!looksClickable(element)) {
      continue;
    }

    // Reachable by arrow keys / a virtual cursor rather than Tab (roving tabindex,
    // a composite container, or aria-activedescendant): deliberately out of the Tab
    // sequence, not unreachable. Its container is the keyboard entry point.
    if (isFocusManaged(element)) {
      continue;
    }

    // Inside an inert subtree (e.g. the background while a modal is open): nothing
    // here is reachable by mouse OR keyboard, by design. That's a focus-trap concern
    // (focus-escapes-modal), not a clickable-but-unfocusable bug, so don't flag it.
    if (isInert(element)) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      continue;
    } // not rendered / no target
    const selector = selectorFor(element);
    out.push({
      rule: "clickable-not-focusable",
      message: `"${selector}" looks interactive (role or onclick) but is not in the tab order, so keyboard users can't reach it. Use a <button>/<a>, or add tabindex="0" plus Enter/Space handlers.`,
      docs: RULE_DOCS["clickable-not-focusable"],
      element,
      selector,
    });
  }

  return out;
};

/** A composite widget (toolbar, tablist, menu, …) should be a single tab stop and
    move between items with the arrow keys (roving tabindex), not N tab stops. */
export const compositeRovingTabindex: Rule = (sequence) => {
  const groups = new Map<Element, SequenceEntry[]>();
  for (const entry of sequence) {
    const container = compositeAncestor(entry.element);
    if (!container) {
      continue;
    }
    const list = groups.get(container) ?? [];
    list.push(entry);
    groups.set(container, list);
  }

  const out: Finding[] = [];
  for (const [container, members] of groups) {
    if (members.length < 2) {
      continue;
    }

    const role = container.getAttribute("role");
    for (const member of members) {
      out.push(
        entryViolation(
          "composite-roving-tabindex",
          member,
          `${members.length} items inside role="${role}" are separate tab stops. A ${role} should expose one tab stop and move between items with the arrow keys (roving tabindex).`,
        ),
      );
    }
  }

  return out;
};

/** While a modal dialog is open, content behind it must be inert. If background
    controls stay tabbable, focus leaks out of the dialog. */
export const focusEscapesModal: Rule = (sequence, { container }) => {
  const modal = openModal(container);
  if (!modal) {
    return [];
  }

  const leaked = sequence.filter(
    (entry) => !modal.contains(entry.element) && !isInert(entry.element),
  );

  if (leaked.length === 0) {
    return [];
  }

  const first = leaked[0]!;
  const subject =
    leaked.length === 1
      ? `"${first.selector}" outside it is still tabbable`
      : `${leaked.length} controls outside it are still tabbable (e.g. "${first.selector}")`;

  return [
    {
      ...entryViolation(
        "focus-escapes-modal",
        first,
        `A modal dialog is open, but ${subject}, so focus can leak behind the dialog. Mark background content inert (or aria-hidden + remove it from the tab order).`,
      ),
      // One finding, anchored on the first leaked control, but every other leaked
      // control shares the root cause (background not inert) and is ringed too.
      relatedElements: leaked.slice(1).map((entry) => entry.element),
    },
  ];
};

/** tabindex="0" on a plain, role-less, non-interactive element turns decorative
    content into a dead tab stop. Scrollable containers are intentionally exempt. */
export const tabindexOnNoninteractive: Rule = (sequence) => {
  const out: Finding[] = [];
  for (const entry of sequence) {
    if (entry.tabIndex !== 0) {
      continue;
    }
    if (entry.element.getAttribute("tabindex") === null) {
      continue;
    } // implicitly focusable
    const element = entry.element as HTMLElement;
    if (isInteractive(element)) {
      continue;
    }
    if (element.isContentEditable) {
      continue;
    }
    if (element.getAttribute("role")) {
      continue;
    }
    // A keyboard-scrollable region legitimately takes tabindex="0", even when it
    // isn't currently overflowing, so key on computed overflow, not a live size.
    if (isScrollContainer(element)) {
      continue;
    }
    out.push(
      entryViolation(
        "tabindex-on-noninteractive",
        entry,
        `"${entry.selector}" has tabindex="0" but is non-interactive (no role, not a control). If it's decorative, remove the tabindex, since it adds a dead stop to the tab order; if it's meant to be a control, give it a real role (or use a <button>).`,
      ),
    );
  }
  return out;
};

/** A generic element (<div>, <span>, …) reimplementing a native control via an
    interactive role rather than using the native element. The native one brings
    focus, keyboard activation, and SR semantics for free; the "first rule of ARIA". */
export const preferNativeElement: Rule = (sequence) => {
  const out: Finding[] = [];
  for (const entry of sequence) {
    const native = nativeReplacement(entry.element);
    if (!native) {
      continue;
    }
    const tag = entry.element.tagName.toLowerCase();
    const role = entry.element.getAttribute("role");
    out.push(
      entryViolation(
        "prefer-native-element",
        entry,
        `"${entry.selector}" is a <${tag}> with role="${role}". Prefer a native ${native}: focus, keyboard activation (Enter/Space), and screen-reader semantics come for free, instead of being reimplemented with ARIA + JS.`,
      ),
    );
  }
  return out;
};

/** autofocus applies to any *focusable* element (even tabindex="-1" non-stops), and
    the browser focuses the first in *document* order — so scan the whole container,
    not `sequence`. The first focusable one wins; the rest are dead intent. */
export const duplicateAutofocus: Rule = (_sequence, { container }) => {
  const focusableAutofocus = Array.from(
    container.querySelectorAll("[autofocus]"),
  ).filter((element) => isFocusable(element, { getShadowRoot: true }));
  if (focusableAutofocus.length < 2) {
    return [];
  }

  return focusableAutofocus.slice(1).map((element) => {
    const selector = selectorFor(element);

    return {
      rule: "duplicate-autofocus",
      message: `"${selector}" also has autofocus, but a page can autofocus only one element; the first focusable one in document order wins, so this one is silently ignored. Remove the extra autofocus.`,
      docs: RULE_DOCS["duplicate-autofocus"],
      element,
      selector,
    };
  });
};

/** `autofocus` on an element that isn't focusable (a bare <div>, no tabindex, not a
    form control) does nothing on load — dead markup. Flag it so it's removed or the
    element is made focusable. */
export const autofocusNotFocusable: Rule = (_sequence, { container }) => {
  const out: Finding[] = [];
  for (const element of container.querySelectorAll("[autofocus]")) {
    if (isFocusable(element, { getShadowRoot: true })) {
      continue;
    }

    const selector = selectorFor(element);
    out.push({
      rule: "autofocus-not-focusable",
      message: `"${selector}" has autofocus but isn't focusable (no tabindex, not a form control), so it's ignored on load. Remove the autofocus, or make the element focusable (e.g. tabindex="-1").`,
      docs: RULE_DOCS["autofocus-not-focusable"],
      element,
      selector,
    });
  }

  return out;
};

/** A focusable control nested inside another focusable element (a <button> in an
    <a href>, or a control inside a tabindex'd wrapper). Two stacked tab stops land
    on the same spot, and screen readers may merge or drop the inner control's role
    and name. */
export const nestedInteractive: Rule = (sequence, { container }) => {
  const stop = container.parentElement;
  const out: Finding[] = [];
  for (const entry of sequence) {
    for (
      let node = entry.element.parentElement;
      node && node !== stop;
      node = node.parentElement
    ) {
      if (!isFocusable(node, { getShadowRoot: true })) {
        continue;
      }

      out.push(
        entryViolation(
          "nested-interactive",
          entry,
          `"${entry.selector}" is focusable but nested inside another focusable element ("${selectorFor(node)}"). Nesting interactive controls stacks two tab stops in one place and can hide the inner control's role/name from screen readers; don't put a focusable element inside another.`,
        ),
      );

      break;
    }
  }

  return out;
};

/** A natively focusable element (<button>, <a href>, <input>, …) carrying an
    explicit tabindex="0". It's already a tab stop, so the attribute is a no-op:
    redundant markup that adds noise and invites a positive value to creep in later.
    tabindex="-1" (removed from the sequence) and positive values (no-positive-tabindex)
    aren't redundant and never reach here. */
export const redundantTabindex: Rule = (sequence) => {
  const out: Finding[] = [];
  for (const entry of sequence) {
    if (entry.tabIndex !== 0) {
      continue;
    }

    if (entry.element.getAttribute("tabindex") === null) {
      continue;
    } // implicitly focusable, no attribute to remove

    if (!isNativelyFocusable(entry.element)) {
      continue;
    }

    out.push(
      entryViolation(
        "redundant-tabindex",
        entry,
        `"${entry.selector}" is already focusable, so its tabindex="0" is redundant. Remove the attribute; the element stays in the tab order on its own.`,
      ),
    );
  }
  return out;
};

export const ALL_RULES = {
  "no-positive-tabindex": noPositiveTabIndex,
  "visual-order-mismatch": visualOrderMismatch,
  "missing-accessible-name": missingAccessibleName,
  "aria-hidden-focusable": ariaHiddenFocusable,
  "hidden-while-focusable": hiddenWhileFocusable,
  "clickable-not-focusable": clickableNotFocusable,
  "composite-roving-tabindex": compositeRovingTabindex,
  "focus-escapes-modal": focusEscapesModal,
  "tabindex-on-noninteractive": tabindexOnNoninteractive,
  "prefer-native-element": preferNativeElement,
  "duplicate-autofocus": duplicateAutofocus,
  "autofocus-not-focusable": autofocusNotFocusable,
  "nested-interactive": nestedInteractive,
  "redundant-tabindex": redundantTabindex,
} as const;
