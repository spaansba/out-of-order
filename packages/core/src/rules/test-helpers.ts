import { audit, flaggedEntries } from "../index.js";

/** Render `html` and return the set of rule ids that fired on it. */
export function fired(html: string): Set<string> {
  document.body.innerHTML = html;
  return new Set(flaggedEntries(audit(document.body)).flatMap((e) => e.issues.map((i) => i.rule)));
}
