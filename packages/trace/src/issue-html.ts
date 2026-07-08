import type { Issue } from "@out-of-order/core";

export type RenderableIssue = Pick<
  Issue,
  "rule" | "severity" | "message" | "fix" | "docs" | "ignored"
>;

/** One finding: rule label, message, and, when the element approved it with a
    `data-ooo-ignore`, a note that it's silenced (so a muted row still explains
    itself instead of looking clean-by-accident). */
export function issueHtml(issue: RenderableIssue): string {
  const cls = issue.ignored ? "ooo-issue ooo-issue--ignored" : "ooo-issue";
  const note = issue.ignored
    ? `<span class="ooo-issue-ignored">Ignored via <code>data-ooo-ignore</code></span>`
    : "";
  const fix = issue.fix
    ? `<span class="ooo-issue-fix"><span class="ooo-issue-fix-label">Possible fix</span>${codeTags(issue.fix)}</span>`
    : "";
  return (
    `<div class="${cls}">${ruleLabel(issue)}` +
    `<span class="ooo-issue-msg">${codeTags(issue.message)}</span>${fix}${note}</div>`
  );
}

// "Open in new tab" glyph, inherits the rule's colour via currentColor.
const EXTERNAL_ICON =
  `<svg class="ooo-issue-rule-ic" viewBox="0 0 24 24" width="11" height="11" fill="none" ` +
  `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>` +
  `<path d="M15 4h5v5"/><path d="M20 4l-9 9"/></svg>`;

// The rule id, linked to its spec doc when one is known (always, in practice).
function ruleLabel(issue: RenderableIssue): string {
  // Amber for warnings, red (the default) for errors, matching badge and ring.
  const cls =
    issue.severity === "warning" ? "ooo-issue-rule ooo-issue-rule--warn" : "ooo-issue-rule";
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

export function escapeHtml(str: string): string {
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
      `<code class="ooo-issue-code">${escapeHtml(m[0])}</code>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(str.slice(last));
}
