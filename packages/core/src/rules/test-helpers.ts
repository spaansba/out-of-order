import { audit } from "../index.js";

/** Render `html` and return the set of rule ids that fired on it. */
export function fired(html: string): Set<string> {
  document.body.innerHTML = html;
  return new Set(audit(document.body).violations.flatMap((v) => v.issues.map((i) => i.rule)));
}
