# @out-of-order/extension

Chrome side panel that audits the current tab's keyboard tab order with
[`@out-of-order/core`](../core). Findings list rule, severity, message, and a
possible fix. Click a finding's selector to scroll to the element on the page.

## Usage

Click the toolbar icon to open the side panel. While it is open, the active tab
is audited continuously:

- The [`@out-of-order/trace`](../trace) overlay is drawn on the page: numbered
  tab stops, the path between them, findings ringed in place (without its
  floating panel, the side panel is the control surface).
- The findings list updates live as the page changes, and follows you across
  tab switches and navigations.
- Click a finding's selector to scroll to and flash that element.

Close the panel to stop auditing: the overlay and the analyzer detach from the
page.

## How it works

The panel injects the bundled analyzer into the page's isolated world and holds
a port to it. The content script mounts the overlay for as long as the port is
open and pushes a serialized snapshot on every re-analysis, so the panel never
polls. Elements can't cross the message boundary, so the panel points back at
an element by array index into the content script's cached live violations.

Permissions: `scripting` and `sidePanel`. Host access is optional and requested
at runtime: the first time the panel needs to reach a page it offers a one-time
"Allow access to all sites" prompt (revocable in the extension's settings), so
installing shows no broad-access warning. Everything is bundled, nothing leaves
the browser.
