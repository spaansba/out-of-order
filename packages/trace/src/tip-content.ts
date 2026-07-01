// Builds the HTML for the overlay's hover tooltips. Pure templating, split out of
// the orchestrator so index.ts stays about analysis-to-draw-model translation.
import type { Violation } from "@out-of-order/core";

/** The screen-reader facts a badge tooltip renders for one element. */
export interface BadgeTipData {
  /** Stop number, or null for an off-sequence (⊘) marker. */
  num: number | null;
  selector: string;
  tabIndex: number | null;
  violations: Violation[];
  name: string;
  role: string;
  description: string;
  autofocus: boolean;
}

/** A badge's tooltip: header (index + selector), the a11y ledger, then either the
    element's findings or a clean "no issues" note. */
export function badgeTip(data: BadgeTipData): string {
  const { num, selector, tabIndex, violations, name, role, description, autofocus } =
    data;

  // Stop number, or ⊘ for an off-sequence (interactive-but-unreachable) marker.
  const idx =
    num !== null
      ? `<span class="ooo-tip-idx">${num}</span>`
      : `<span class="ooo-tip-idx ooo-tip-idx--off">⊘</span>`;

  // A labelled ledger of what the screen reader sees: accessible name, role, the
  // optional description, and the tabindex. Name/role always show (— when absent);
  // the usually-empty description and a non-default tabindex appear only when set.
  const fields =
    field("name", name ? escapeHtml(name) : null) +
    field("role", role ? mono(escapeHtml(role)) : null) +
    (description ? field("description", escapeHtml(description)) : "") +
    (tabIndex && tabIndex !== 0 ? field("tabindex", mono(String(tabIndex))) : "") +
    // Informational, not a finding: this is where focus lands on page load.
    (autofocus ? field("autofocus", mono("yes")) : "");

  const body = violations.length
    ? `<ul class="ooo-tip-list">${violations
        .map(
          (violation) =>
            `<li class="ooo-tip-item">${ruleLabel(violation)}` +
            `<span class="ooo-tip-msg">${escapeHtml(stripSelectorPrefix(violation.message))}</span></li>`,
        )
        .join("")}</ul>`
    : `<p class="ooo-tip-ok">No issues found.</p>`;
  return (
    `<div class="ooo-tip-head">${idx}<code class="ooo-tip-sel">${escapeHtml(selector)}</code></div>` +
    `<dl class="ooo-tip-fields">${fields}</dl>` +
    `<div class="ooo-tip-body">${body}</div>`
  );
}

/** Tooltip for a hop between stops #from and #to. */
export function segTip(back: boolean, from: number, toStop: number): string {
  const flag = back
    ? `<span class="ooo-tip-flag ooo-tip-flag--back">↩ reverse</span>`
    : `<span class="ooo-tip-flag">→ forward</span>`;
  const message = back
    ? "Focus moves against the reading order — up, or right-to-left."
    : "Forward in reading order.";
  return (
    `<div class="ooo-tip-head">${flag}<span class="ooo-tip-hop">#${from} → #${toStop}</span></div>` +
    `<div class="ooo-tip-body"><p class="ooo-tip-msg">${message}</p></div>`
  );
}

// One ledger row (term + value). A null value renders a muted em dash, so a missing
// accessible name or role reads as "absent" rather than silently dropping the row.
function field(key: string, value: string | null): string {
  return `<dt>${key}</dt><dd>${value ?? `<span class="ooo-tip-dim">—</span>`}</dd>`;
}

// Inline monospace value (role, tabindex, the autofocus flag).
function mono(html: string): string {
  return `<span class="ooo-tip-mono">${html}</span>`;
}

// "Open in new tab" glyph, inherits the rule's colour via currentColor.
const EXTERNAL_ICON =
  `<svg class="ooo-tip-rule-ic" viewBox="0 0 24 24" width="11" height="11" fill="none" ` +
  `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>` +
  `<path d="M15 4h5v5"/><path d="M20 4l-9 9"/></svg>`;

// The rule id, linked to its spec doc when one is known (always, in practice).
// tabindex="-1": the tooltip is a hover-only, invoker-less popover, so a keyboard
// user can never open it to reach the link anyway. Keeping it out of the tab order
// stops the analyzer (which reads the live DOM) from numbering it as a stray stop.
function ruleLabel(violation: Violation): string {
  // Amber for warnings, red (the default) for errors, matching badge and ring.
  const cls =
    violation.severity === "warning"
      ? "ooo-tip-rule ooo-tip-rule--warn"
      : "ooo-tip-rule";
  if (!violation.docs) {
    return `<span class="${cls}">${violation.rule}</span>`;
  }
  return (
    `<a class="${cls}" href="${escapeHtml(violation.docs)}" target="_blank" rel="noreferrer" tabindex="-1">` +
    `<span>${violation.rule}</span>${EXTERNAL_ICON}</a>`
  );
}

/** Messages start with the selector for log/test use; the tooltip already shows
    it in the header, so trim a leading `"selector" ` to avoid repeating it. */
function stripSelectorPrefix(message: string): string {
  return message.replace(/^"[^"]*"\s*/, "");
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char);
}
