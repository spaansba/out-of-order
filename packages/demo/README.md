# @focuspocus/demo

Interactive demo. Two pages, both thin consumers of [`@focuspocus/core/overlay`](../core). The overlay comes entirely from the library, so this could be rebuilt in React, Vue, or anything else without changing the core.

- **`index.html`** is a gallery of focus and keyboard-access bugs: positive `tabindex` scrambling a form, DOM order fighting visual order, an `aria-hidden` focusable control, an icon button with no accessible name, a clickable `<div>` the keyboard can't reach, and a modal that never traps focus. The overlay's path zig-zags and rings every violation red.
- **`tabbable.html`** is a gauntlet of tabbable edge cases (disabled, hidden, `tabindex` variants, `inert`, `contenteditable`, readonly, SVG, shadow DOM, a keyboard-focusable scroll container). The overlay numbers the real tab sequence; things that shouldn't be tabbable get no number.

## Run

```bash
pnpm install
pnpm --filter @focuspocus/demo dev
```

Then open the printed URL (the nav switches between the two pages). No build of `@focuspocus/core` is needed first; `vite.config.ts` aliases the package to its TypeScript source.

## The point

Each page's script is ~15 lines:

```ts
import { mountOverlay } from "@focuspocus/core/overlay";

// No `root` → analyzes the whole document, exactly like tabbing through the page.
const overlay = mountOverlay();
```

Everything visual is the library's job: the numbered SVG path, the per-stop rings, the arrows, and the hover tooltips.
