# @focuspocus/reveal

Drops a visual overlay on any live page: every tab stop gets a numbered badge,
each hop between stops is drawn as a line (red when it runs against reading
order), and every accessibility finding is ringed in place with a tooltip
spelling out the accessible name, role, and rule.

It is a thin visual layer over [`@focuspocus/core`](../core): the analysis comes
entirely from `analyzeTabOrder`, so the same verdicts you assert in tests are
what you see on screen.

```ts
import { reveal } from "@focuspocus/reveal";

const overlay = reveal();
// ...
overlay.destroy();
```

`reveal(options?)` returns a `RevealHandle` with `refresh()`, `reposition()`,
`setVisible(visible)`, `destroy()`, and the latest `result`. The overlay
re-analyzes itself on DOM mutation, so most pages need nothing beyond the mount.
