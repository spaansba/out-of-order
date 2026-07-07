import type { Issue } from "@out-of-order/core";
import { escapeHtml, issueHtml } from "./issue-html.js";

/** The screen-reader facts a badge tooltip renders for one element. */
interface BadgeTipData {
  /** Stop number, or null for an off-sequence (⊘) marker. */
  num: number | null;
  selector: string;
  tabIndex: number | null;
  issues: Issue[];
  name: string;
  role: string;
  description: string;
  autofocus: boolean;
  srOnly: boolean;
}

export function badgeTip(data: BadgeTipData): string {
  const { num, selector, tabIndex, issues, name, role, description, autofocus, srOnly } = data;

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
    (autofocus ? field("autofocus", mono("yes")) : "") +
    (srOnly ? field("sr-only", mono("yes")) : "");

  const body = issues.length
    ? `<div class="ooo-tip-list">${issues.map(issueHtml).join("")}</div>`
    : `<p class="ooo-tip-ok">No issues found.</p>`;
  return (
    `<div class="ooo-tip-head">${idx}<code class="ooo-tip-sel">${escapeHtml(selector)}</code></div>` +
    `<dl class="ooo-tip-fields">${fields}</dl>` +
    `<div class="ooo-tip-body">${body}</div>`
  );
}

export function segmentTip(back: boolean, from: number, toStop: number): string {
  const flag = back
    ? `<span class="ooo-tip-flag ooo-tip-flag--back">↩ reverse</span>`
    : `<span class="ooo-tip-flag">→ forward</span>`;
  const message = back
    ? "Focus moves against the reading order, to an earlier line or backward within one."
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

function mono(html: string): string {
  return `<span class="ooo-tip-mono">${html}</span>`;
}
