import type { Issue } from "@out-of-order/core";

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
    ? `<ul class="ooo-tip-list">${issues.map(issueItem).join("")}</ul>`
    : `<p class="ooo-tip-ok">No issues found.</p>`;
  return (
    `<div class="ooo-tip-head">${idx}<code class="ooo-tip-sel">${escapeHtml(selector)}</code></div>` +
    `<dl class="ooo-tip-fields">${fields}</dl>` +
    `<div class="ooo-tip-body">${body}</div>`
  );
}

/** One finding row: rule label, message, and, when the element approved it with a
    `data-ooo-ignore`, a note that it's silenced (so a muted badge still explains
    itself instead of looking clean-by-accident). */
function issueItem(issue: Issue): string {
  const cls = issue.ignored ? "ooo-tip-item ooo-tip-item--ignored" : "ooo-tip-item";
  const note = issue.ignored
    ? `<span class="ooo-tip-ignored">Ignored via <code>data-ooo-ignore</code></span>`
    : "";
  const fix = issue.fix
    ? `<span class="ooo-tip-fix"><span class="ooo-tip-fix-label">Possible fix</span>${codeTags(issue.fix)}</span>`
    : "";
  return (
    `<li class="${cls}">${ruleLabel(issue)}` +
    `<span class="ooo-tip-msg">${codeTags(issue.message)}</span>${fix}${note}</li>`
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

// "Open in new tab" glyph, inherits the rule's colour via currentColor.
const EXTERNAL_ICON =
  `<svg class="ooo-tip-rule-ic" viewBox="0 0 24 24" width="11" height="11" fill="none" ` +
  `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>` +
  `<path d="M15 4h5v5"/><path d="M20 4l-9 9"/></svg>`;

// The rule id, linked to its spec doc when one is known (always, in practice).
function ruleLabel(issue: Issue): string {
  // Amber for warnings, red (the default) for errors, matching badge and ring.
  const cls = issue.severity === "warning" ? "ooo-tip-rule ooo-tip-rule--warn" : "ooo-tip-rule";
  if (!issue.docs) {
    return `<span class="${cls}">${issue.rule}</span>`;
  }
  return (
    `<a class="${cls}" href="${escapeHtml(issue.docs)}" target="_blank" rel="noreferrer">` +
    `<span>${issue.rule}</span>${EXTERNAL_ICON}</a>`
  );
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

// Code-like tokens in rule prose. Ordered so the most specific alternative wins at a
// given position (role="button" is one token, not a bare word plus a quote). Only
// unambiguous forms are listed, so plain-English words (role, title, focus) stay prose.
const CODE_TOKEN = new RegExp(
  [
    /[a-zA-Z][\w-]*="[^"]*"/, // attribute with value: role="button", tabindex="0"
    /<[a-z][\w-]*>/, // tag mention: <button>
    /(?:aria|data)-[\w-]+/, // aria-label, data-ooo-ignore
    /\b(?:tabindex|autofocus|inert|onclick|alt)\b/, // bare attribute names
    /\b[a-z-]+:[a-z0-9-]+(?:\([^)]*\))?/, // css declaration: display:none, opacity:0, filter:opacity(0)
    /:(?:hover|focus|active|focus-visible)\b/, // css pseudo-class
    /\b(?:Enter|Space)\b/, // key names
    /"[^"]*"/, // quoted selector
  ]
    .map((r) => r.source)
    .join("|"),
  "g",
);

// Escape rule text, then wrap code-like tokens (tags, attributes, selectors, keys) in
// styled <code> so they read as code rather than prose.
function codeTags(str: string): string {
  let out = "";
  let last = 0;
  for (const m of str.matchAll(CODE_TOKEN)) {
    out +=
      escapeHtml(str.slice(last, m.index)) +
      `<code class="ooo-tip-code">${escapeHtml(m[0])}</code>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(str.slice(last));
}
