---
"@out-of-order/core": patch
---

`tabindex-on-noninteractive` now flags a static-content role carrying `tabindex="0"` (e.g. `<div role="note" tabindex="0">`). The rule passed any explicit role other than `presentation`/`none`, so non-interactive document-structure roles slipped through even though they add a dead stop to the tab order. It now passes only interactive roles (already cleared by `isInteractive`) and focusable-container roles like `tabpanel`, flagging the static-content roles.
