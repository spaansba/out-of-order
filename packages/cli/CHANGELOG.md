# @out-of-order/cli

## 0.2.2

### Patch Changes

- [`1f01630`](https://github.com/spaansba/out-of-order/commit/1f01630af6d61f8e68e27372d5aea4393f901893) Thanks [@spaansba](https://github.com/spaansba)! - Headless audits no longer advertise `HeadlessChrome` in the user agent. Backends that reject it served the audit a login or block page the headed `--overlay` never sees, so the two commands silently disagreed. Headless runs now present the same UA a headed run would.

  Audits that find zero tabbable elements now exit 2 with a hint to use `--wait <selector>`, instead of passing silently. A page that renders after load (SPA loading screen) produced a vacuous "No tab-order issues."

## 0.1.1

### Patch Changes

- Updated dependencies [[`0922308`](https://github.com/spaansba/out-of-order/commit/09223082ff59a6fa82b782195afb92b960730358)]:
  - @out-of-order/core@0.1.1
  - @out-of-order/trace@0.1.1
