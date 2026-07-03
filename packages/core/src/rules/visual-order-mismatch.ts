import {
  closestAncestor,
  composedParent,
  containsComposed,
  isScrollContainer,
} from "../dom/index.js";
import type { Finding, RuleDef, RuleRun } from "./rule.js";

/** px tolerance for treating two stops as the same visual line. Elements on one line
    rarely share an exact block position (height/padding/baseline differ), and below
    ~8px a sighted user doesn't perceive a line break. */
const LINE_TOLERANCE_PX = 8;

/** The nearest fixed/sticky ancestor-or-self: the scroll-detached "chrome" layer
    (sticky navbar, fixed header) the element rides in, or null if it sits in
    normal flow. */
function floatingAncestor(element: Element): Element | null {
  return closestAncestor(element, (node) => {
    const pos = getComputedStyle(node).position;

    return pos === "fixed" || pos === "sticky";
  });
}

/** The nearest ancestor that independently scrolls `element` (excluding itself), or
    null if it only rides the document scroll. Two stops with different scroll
    ancestors don't share a scroll context, so the visual-order check skips the pair
    (their on-screen relationship moves with the scrollbar). */
function scrollAncestor(element: Element): Element | null {
  return closestAncestor(element.parentElement, isScrollContainer);
}

/** The deepest element containing both `a` and `b` in the composed tree. */
function commonAncestor(a: Element, b: Element): Element | null {
  const ancestors = new Set<Element>();
  for (let node: Element | null = a; node; node = composedParent(node)) {
    ancestors.add(node);
  }
  return closestAncestor(b, (node) => ancestors.has(node));
}

/** A rect in flow-relative coordinates: `block*` along the line-stacking axis,
    `inline*` along the reading direction within a line. Both axes grow toward
    "later in reading order", so the ordering check itself needs no knowledge of
    the writing mode that produced them. */
interface LogicalRect {
  blockStart: number;
  blockEnd: number;
  inlineStart: number;
  inlineEnd: number;
}

function toLogical(rect: DOMRect, style: CSSStyleDeclaration): LogicalRect {
  const mode = style.writingMode;
  const rtl = style.direction === "rtl";
  const vertical = mode.startsWith("vertical") || mode.startsWith("sideways");

  if (!vertical) {
    return rtl
      ? {
          blockStart: rect.top,
          blockEnd: rect.bottom,
          inlineStart: -rect.right,
          inlineEnd: -rect.left,
        }
      : {
          blockStart: rect.top,
          blockEnd: rect.bottom,
          inlineStart: rect.left,
          inlineEnd: rect.right,
        };
  }
  // Vertical modes: lines stack horizontally (*-rl right→left, *-lr left→right)
  // and text runs vertically, downward except when rtl flips it (or upward to
  // begin with in sideways-lr).
  const blockStart = mode.endsWith("-lr") ? rect.left : -rect.right;
  const blockEnd = mode.endsWith("-lr") ? rect.right : -rect.left;
  const inlineDown = mode === "sideways-lr" ? rtl : !rtl;
  return inlineDown
    ? { blockStart, blockEnd, inlineStart: rect.top, inlineEnd: rect.bottom }
    : { blockStart, blockEnd, inlineStart: -rect.bottom, inlineEnd: -rect.top };
}

/** Whether `outer` fully covers `inner`. Two boxes drawn one inside the other
    have no meaningful before/after relationship. */
function encloses(outer: LogicalRect, inner: LogicalRect): boolean {
  return (
    outer.blockStart <= inner.blockStart &&
    outer.blockEnd >= inner.blockEnd &&
    outer.inlineStart <= inner.inlineStart &&
    outer.inlineEnd >= inner.inlineEnd
  );
}

/**
 * The tab sequence should match the visual reading order. A mismatch is local:
 * it happens between two consecutive tab stops when the second one sits visually
 * *before* the first (an earlier line, or the same line but before it in the
 * reading direction), i.e. Tab makes a backward hop. "Before" follows the writing
 * mode in effect where the two stops are laid out, so an RTL row or a vertical-rl
 * page is judged by its own reading order, not by top→bottom, left→right.
 */
const run: RuleRun = (sequence) => {
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

    // A hop between a focusable container and its own content isn't a reading-order
    // move either: focus drills into (or climbs out of) the box, and a box has no
    // before/after relationship with something inside it.
    if (
      containsComposed(prev.element, cur.element) ||
      containsComposed(cur.element, prev.element)
    ) {
      continue;
    }

    // Reading order is set by the writing mode of the context that lays the two
    // stops out relative to each other: their nearest common ancestor. Judging an
    // RTL or vertical layout in physical coordinates flags every ordinary row.
    const context = commonAncestor(prev.element, cur.element) ?? document.documentElement;
    const style = getComputedStyle(context);
    const prevRect = toLogical(prev.rect, style);
    const curRect = toLogical(cur.rect, style);

    // Boxes drawn one inside the other (a control overlaying its card) have no
    // meaningful order even without a DOM relationship.
    if (encloses(prevRect, curRect) || encloses(curRect, prevRect)) {
      continue;
    }

    // A stop whose box sits entirely inline-after prev starts a later column.
    // Multi-column reading runs down one column then jumps to the START of the
    // next, so this block-backward move is a forward column advance, not a
    // backward hop. Without this, every column break misfires.
    const nextColumn = curRect.inlineStart >= prevRect.inlineEnd;

    const earlierLine = curRect.blockEnd <= prevRect.blockStart + LINE_TOLERANCE_PX;
    const sameLine = !earlierLine && curRect.blockStart < prevRect.blockEnd - LINE_TOLERANCE_PX;
    // 1px center fudge so co-located stops (stacked overlays) don't flip on
    // sub-pixel differences.
    const prevMid = (prevRect.inlineStart + prevRect.inlineEnd) / 2;
    const curMid = (curRect.inlineStart + curRect.inlineEnd) / 2;
    const backwardHop = !nextColumn && (earlierLine || (sameLine && curMid < prevMid - 1));
    if (!backwardHop) {
      continue;
    }

    out.push({
      message: `Element comes after "${prev.selector}" in the tab order, but sits visually before it in reading order. Tab makes a backward hop here.`,
      fix: `Reorder the DOM to match the visual reading order, or adjust the layout so it follows the DOM order.`,
      target: cur,
    });
  }

  return out;
};

export const visualOrderMismatch: RuleDef = {
  docs: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html",
  severity: "warning",
  run,
};
