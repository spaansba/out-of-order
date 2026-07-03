---
"@out-of-order/cli": patch
---

Headless audits no longer advertise `HeadlessChrome` in the user agent. Backends that reject it served the audit a login or block page the headed `--overlay` never sees, so the two commands silently disagreed. Headless runs now present the same UA a headed run would.

Audits that find zero tabbable elements now exit 2 with a hint to use `--wait <selector>`, instead of passing silently. A page that renders after load (SPA loading screen) produced a vacuous "No tab-order issues."
