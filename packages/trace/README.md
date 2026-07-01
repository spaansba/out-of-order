# @out-of-order/trace

> ⚠️ **Under heavy development.** Released, but the API is still changing and may break between versions.

Drops a visual overlay on any live page: every tab stop gets a numbered badge,
each hop between stops is drawn as a line (red when it runs against reading
order), and every accessibility finding is ringed in place with a tooltip
spelling out the accessible name, role, and rule.

It is a thin visual layer over [`@out-of-order/core`](../core): the analysis comes
entirely from `audit`, so the same verdicts you assert in tests are
what you see on screen.

```ts
import { trace } from "@out-of-order/trace";

const overlay = trace();
// ...
overlay.destroy();
```

`trace(options?)` returns a `TraceHandle` with `refresh()`, `reposition()`,
`setVisible(visible)`, `destroy()`, and the latest `result`. The overlay
re-analyzes itself on DOM mutation, so most pages need nothing beyond the mount.
