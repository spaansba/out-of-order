import { computeAccessibleName } from "dom-accessibility-api";
import { isFocusable } from "tabbable";
import type { RuleId, SequenceEntry, Severity } from "./types.js";
import {
  isInteractive,
  hasExplicitName,
  selectorFor,
  hiddenReason,
  focusRevealSelectors,
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

/** Everything a rule may need beyond the sequence itself. */
export interface RuleContext {
  /** The analyzed root element (lets rules look beyond the tab sequence). */
  container: Element;
  inSequence: Set<Element>;
}

/** One problem a rule reports, before grading. */
export interface Finding {
  /** Human-readable description of what's wrong. */
  message: string;
  /** The element the finding points at. A {@link SequenceEntry} when it is a tab
      stop (carries orderIndex and a selector), or a bare Element when it is not. */
  target: SequenceEntry | Element;
  /** Other elements with the same root cause. Ringed alongside `target` but not
      reported as separate findings, so one missing fix doesn't become N violations. */
  relatedElements?: Element[];
}

/** Takes the tab sequence (plus context) and returns any findings. Pure. */
export type RuleRun = (sequence: SequenceEntry[], ctx: RuleContext) => Finding[];

export interface Rule {
  /** Stable rule identifier, surfaced on every Violation it produces. */
  id: string;
  /** Spec link the rule is grounded in (WCAG, WAI-ARIA, or ARIA APG). */
  docs: string;
  /** Severity the rule fires at unless overridden via `AuditOptions.rules`. */
  defaultSeverity: Severity;
  run: RuleRun;
}

/** px tolerance for treating two stops as the same visual row. Elements on one row
    rarely share an exact vertical center (height/padding/baseline differ), and below
    ~8px a sighted user doesn't perceive a row break. */
const ROW_TOLERANCE_PX = 8;

/** Map the tab sequence to at most one finding per entry: return a message to flag
    the entry, or null to pass it. Collapses the boilerplate of the per-entry rules. */
const flagEntries = (
  sequence: SequenceEntry[],
  message: (entry: SequenceEntry) => string | null,
): Finding[] =>
  sequence.flatMap((entry) => {
    const msg = message(entry);
    return msg ? [{ message: msg, target: entry }] : [];
  });

const noPositiveTabIndex: RuleRun = (sequence) =>
  flagEntries(sequence, (entry) =>
    entry.tabIndex > 0
      ? `Element has tabindex="${entry.tabIndex}". Positive tabindex overrides the natural DOM order and is fragile; use 0 or restructure the DOM.`
      : null,
  );

/**
 * The tab sequence should match the visual reading order (top→bottom,
 * left→right). A mismatch is local: it happens between two consecutive tab
 * stops when the second one sits visually *before* the first (an earlier row,
 * or the same row but to its left), i.e. Tab makes a backward hop.
 */
const visualOrderMismatch: RuleRun = (sequence) => {
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
    if (floats[idx - 1] !== floats[idx] || scrollers[idx - 1] !== scrollers[idx]) {
      continue;
    }

    const prevX = prev.rect.left + prev.rect.width / 2;
    const curX = cur.rect.left + cur.rect.width / 2;

    // A stop whose box sits entirely to the right of prev starts a later column.
    // Multi-column reading runs down one column then jumps to the TOP of the next,
    // so this upward move is a forward column advance, not a backward hop. Without
    // this, every column break (left column's end → right column's start) misfires.
    const nextColumn = cur.rect.left >= prev.rect.right;

    const earlierRow = cur.rect.bottom <= prev.rect.top + ROW_TOLERANCE_PX;
    const sameRow = !earlierRow && cur.rect.top < prev.rect.bottom - ROW_TOLERANCE_PX;
    const backwardHop = !nextColumn && (earlierRow || (sameRow && curX < prevX - 1));
    if (!backwardHop) {
      continue;
    }

    out.push({
      message: `"${cur.selector}" comes after "${prev.selector}" in the tab order, but sits visually before it (reading order is top→bottom, left→right). Tab makes a backward hop here.`,
      target: cur,
    });
  }

  return out;
};

const missingAccessibleName: RuleRun = (sequence) =>
  flagEntries(sequence, (entry) => {
    if (!isInteractive(entry.element)) {
      return null;
    }
    // Skip the costly subtree walk when a name is already guaranteed.
    if (hasExplicitName(entry.element)) {
      return null;
    }
    if (computeAccessibleName(entry.element).trim() !== "") {
      return null;
    }
    return `Focusable element "${entry.selector}" has no accessible name (no text, aria-label, aria-labelledby, associated label, alt, or title).`;
  });

const ariaHiddenFocusable: RuleRun = (sequence) =>
  flagEntries(sequence, (entry) =>
    inAriaHidden(entry.element)
      ? `"${entry.selector}" is tabbable but inside aria-hidden="true", so a screen-reader user lands on a control the SR won't announce. Add tabindex="-1"/inert, or remove aria-hidden.`
      : null,
  );

const hiddenWhileFocusable: RuleRun = (sequence, { container }) => {
  // Scan the page's focus-reveal rules once, not per element.
  const revealOnFocus = focusRevealSelectors(container.ownerDocument);
  return flagEntries(sequence, (entry) => {
    const reason = hiddenReason(entry.element, entry.rect, revealOnFocus);
    return reason
      ? `"${entry.selector}" is tabbable but ${reason}. Hide it from the tab order too (display:none, the hidden attribute, or tabindex="-1").`
      : null;
  });
};

const clickableNotFocusable: RuleRun = (_sequence, { container, inSequence }) => {
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
      message: `"${selector}" looks interactive (role or onclick) but is not in the tab order, so keyboard users can't reach it. Use a <button>/<a>, or add tabindex="0" plus Enter/Space handlers.`,
      target: element,
    });
  }

  return out;
};

const compositeRovingTabindex: RuleRun = (sequence) => {
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
      out.push({
        message: `${members.length} items inside role="${role}" are separate tab stops. A ${role} should expose one tab stop and move between items with the arrow keys (roving tabindex).`,
        target: member,
      });
    }
  }

  return out;
};

const focusEscapesModal: RuleRun = (sequence, { container }) => {
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
      message: `A modal dialog is open, but ${subject}, so focus can leak behind the dialog. Mark background content inert (or aria-hidden + remove it from the tab order).`,
      target: first,
      // One finding, anchored on the first leaked control, but every other leaked
      // control shares the root cause (background not inert) and is ringed too.
      relatedElements: leaked.slice(1).map((entry) => entry.element),
    },
  ];
};

const tabindexOnNoninteractive: RuleRun = (sequence) =>
  flagEntries(sequence, (entry) => {
    if (entry.tabIndex !== 0) {
      return null;
    }
    if (entry.element.getAttribute("tabindex") === null) {
      return null;
    } // implicitly focusable
    const element = entry.element as HTMLElement;
    if (isNativelyFocusable(element)) {
      return null;
    }
    if (isInteractive(element)) {
      return null;
    }
    if (element.isContentEditable) {
      return null;
    }
    const role = element.getAttribute("role");
    if (role && role !== "presentation" && role !== "none") {
      return null;
    }
    // A keyboard-scrollable region legitimately takes tabindex="0", even when it
    // isn't currently overflowing, so key on computed overflow, not a live size.
    if (isScrollContainer(element)) {
      return null;
    }
    return `"${entry.selector}" has tabindex="0" but is non-interactive (no role, not a control). If it's decorative, remove the tabindex, since it adds a dead stop to the tab order; if it's meant to be a control, give it a real role (or use a <button>).`;
  });

const preferNativeElement: RuleRun = (sequence) =>
  flagEntries(sequence, (entry) => {
    const native = nativeReplacement(entry.element);
    if (!native) {
      return null;
    }
    const tag = entry.element.tagName.toLowerCase();
    const role = entry.element.getAttribute("role");
    return `"${entry.selector}" is a <${tag}> with role="${role}". Prefer a native ${native}: focus, keyboard activation (Enter/Space), and screen-reader semantics come for free, instead of being reimplemented with ARIA + JS.`;
  });

/** autofocus applies to any *focusable* element (even tabindex="-1" non-stops), and
    the browser focuses the first in *document* order — so scan the whole container,
    not `sequence`. The first focusable one wins; the rest are dead intent. */
const duplicateAutofocus: RuleRun = (_sequence, { container }) => {
  const focusableAutofocus = Array.from(container.querySelectorAll("[autofocus]")).filter(
    (element) => isFocusable(element, { getShadowRoot: true }),
  );
  if (focusableAutofocus.length < 2) {
    return [];
  }

  return focusableAutofocus.slice(1).map((element) => {
    const selector = selectorFor(element);

    return {
      message: `"${selector}" also has autofocus, but a page can autofocus only one element; the first focusable one in document order wins, so this one is silently ignored. Remove the extra autofocus.`,
      target: element,
    };
  });
};

const autofocusNotFocusable: RuleRun = (_sequence, { container }) => {
  const out: Finding[] = [];
  for (const element of container.querySelectorAll("[autofocus]")) {
    if (isFocusable(element, { getShadowRoot: true })) {
      continue;
    }

    const selector = selectorFor(element);
    out.push({
      message: `"${selector}" has autofocus but isn't focusable (no tabindex, not a form control), so it's ignored on load. Remove the autofocus, or make the element focusable (e.g. tabindex="-1").`,
      target: element,
    });
  }

  return out;
};

const nestedInteractive: RuleRun = (sequence, { container, inSequence }) => {
  const stop = container.parentElement;
  const out: Finding[] = [];
  for (const entry of sequence) {
    for (let node = entry.element.parentElement; node && node !== stop; node = node.parentElement) {
      if (!inSequence.has(node) && !isInteractive(node)) {
        continue;
      }

      out.push({
        message: `"${entry.selector}" is focusable but nested inside another focusable element ("${selectorFor(node)}"). Nesting interactive controls stacks two tab stops in one place and can hide the inner control's role/name from screen readers; don't put a focusable element inside another.`,
        target: entry,
      });

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
const redundantTabindex: RuleRun = (sequence) =>
  flagEntries(sequence, (entry) => {
    if (entry.tabIndex !== 0) {
      return null;
    }
    if (entry.element.getAttribute("tabindex") === null) {
      return null;
    } // implicitly focusable, no attribute to remove
    if (!isNativelyFocusable(entry.element)) {
      return null;
    }
    return `"${entry.selector}" is already focusable, so its tabindex="0" is redundant. Remove the attribute; the element stays in the tab order on its own.`;
  });

export const ALL_RULES = {
  "no-positive-tabindex": {
    docs: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
    defaultSeverity: "error",
    run: noPositiveTabIndex,
  },
  "visual-order-mismatch": {
    docs: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
    defaultSeverity: "warning",
    run: visualOrderMismatch,
  },
  "missing-accessible-name": {
    docs: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
    defaultSeverity: "error",
    run: missingAccessibleName,
  },
  "aria-hidden-focusable": {
    docs: "https://www.w3.org/TR/wai-aria-1.2/#aria-hidden",
    defaultSeverity: "error",
    run: ariaHiddenFocusable,
  },
  "hidden-while-focusable": {
    docs: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html",
    defaultSeverity: "error",
    run: hiddenWhileFocusable,
  },
  "clickable-not-focusable": {
    docs: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
    defaultSeverity: "error",
    run: clickableNotFocusable,
  },
  "composite-roving-tabindex": {
    docs: "https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/",
    defaultSeverity: "warning",
    run: compositeRovingTabindex,
  },
  "focus-escapes-modal": {
    docs: "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/",
    defaultSeverity: "error",
    run: focusEscapesModal,
  },
  "tabindex-on-noninteractive": {
    docs: "https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/",
    defaultSeverity: "error",
    run: tabindexOnNoninteractive,
  },
  "prefer-native-element": {
    docs: "https://www.w3.org/TR/using-aria/#firstrule",
    defaultSeverity: "warning",
    run: preferNativeElement,
  },
  "duplicate-autofocus": {
    docs: "https://html.spec.whatwg.org/multipage/interaction.html#the-autofocus-attribute",
    defaultSeverity: "warning",
    run: duplicateAutofocus,
  },
  "autofocus-not-focusable": {
    docs: "https://html.spec.whatwg.org/multipage/interaction.html#the-autofocus-attribute",
    defaultSeverity: "warning",
    run: autofocusNotFocusable,
  },
  "nested-interactive": {
    docs: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
    defaultSeverity: "error",
    run: nestedInteractive,
  },
  "redundant-tabindex": {
    docs: "https://html.spec.whatwg.org/multipage/interaction.html#attr-tabindex",
    defaultSeverity: "warning",
    run: redundantTabindex,
  },
} satisfies Record<string, Omit<Rule, "id">>;

export const DEFAULT_SEVERITY = Object.fromEntries(
  Object.entries(ALL_RULES).map(([id, rule]) => [id, rule.defaultSeverity]),
) as Record<RuleId, Severity>;
