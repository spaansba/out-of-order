// Styles for the finding rows rendered by issue-html.ts. Adopted on its own via
// ensureIssueStyles (the extension panel reuses the rows outside the overlay) and
// also folded into the full overlay sheet.
export const ISSUE_CSS = `
.ooo-issue { display: block; }
.ooo-issue-rule { display: flex; align-items: center; gap: 5px; width: fit-content; margin-bottom: 3px;
  font: 600 10px/1.4 var(--ooo-mono);
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--ooo-bad); text-decoration: none; }
.ooo-issue-rule--warn { color: var(--ooo-warn); }
a.ooo-issue-rule:hover > span { text-decoration: underline; text-underline-offset: 2px; }
.ooo-issue-rule-ic { flex: none; opacity: 0.55; }
a.ooo-issue-rule:hover .ooo-issue-rule-ic { opacity: 1; }
.ooo-issue-msg { display: block; margin: 0; color: var(--ooo-ink-2); font-size: 12.5px; }
.ooo-issue-code { font-family: var(--ooo-mono); font-size: 0.88em; padding: 0.5px 3px;
  border-radius: 2px; background: var(--ooo-btn); color: var(--ooo-ink); }
.ooo-issue-fix { display: block; margin-top: 5px; padding-left: 9px;
  border-left: 2px solid var(--ooo-line-2); color: var(--ooo-ink-2); font-size: 12px; }
.ooo-issue-fix-label { display: block;
  font: 600 9.5px/1.6 var(--ooo-mono);
  letter-spacing: 0.07em; text-transform: uppercase; color: var(--ooo-muted-2); }
.ooo-issue--ignored { opacity: 0.7; }
.ooo-issue--ignored .ooo-issue-rule { color: var(--ooo-muted-2); }
.ooo-issue-ignored { display: block; margin-top: 4px; color: var(--ooo-muted); font-size: 11.5px; }
.ooo-issue-ignored code { font-family: var(--ooo-mono);
  font-size: 11px; }
`;
