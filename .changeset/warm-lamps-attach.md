---
"@out-of-order/extension": patch
---

Guard `attach()` against overlapping runs so a superseded attach can't orphan a port. `detach()` at the top could not disconnect the previous port because it was still unset while `executeScript` awaited, so a fast tab switch on a slow-injecting page left the first port connected: its `onMessage` kept pushing the old tab's snapshots into the panel and the old content script never got `onDisconnect`. A generation token now makes any superseded attach bail out before opening a port.
