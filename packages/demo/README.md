# @focuspocus/demo

The project site: a set of docs pages plus two interactive demos, all thin consumers of [`@focuspocus/reveal`](../reveal). The overlay comes entirely from the library, so the demos could be rebuilt in React, Vue, or anything else without changing the core.

**Interactive demos** (both run the overlay):

- **`violations.html`** is a gallery of focus and keyboard-access bugs: positive `tabindex` scrambling a form, DOM order fighting visual order, an `aria-hidden` focusable control, an icon button with no accessible name, a clickable `<div>` the keyboard can't reach, and a modal that never traps focus. The overlay's path zig-zags and rings every violation red.
- **`tabbable.html`** is a gauntlet of tabbable edge cases (disabled, hidden, `tabindex` variants, `inert`, `contenteditable`, readonly, SVG, shadow DOM, a keyboard-focusable scroll container). The overlay numbers the real tab sequence; things that shouldn't be tabbable get no number.

**Docs** (static, no JS, same spec-sheet styling): `index.html` (home), `getting-started.html`, `concepts.html`, `rules.html`, `api.html`, `recipes.html`, `faq.html`. All pages share `src/styles.css` and the same top bar.

## Deploy

The site is built by Vite and published to GitHub Pages by [`.github/workflows/deploy-demo.yml`](../../.github/workflows/deploy-demo.yml) on every push to `main`. Because it serves from a project subpath, `vite.config.ts` sets `base` to `/focuspocus/`; override with `BASE_PATH` for a custom domain or local `vite preview` (e.g. `BASE_PATH=/ pnpm --filter @focuspocus/demo build`).

## Run

```bash
pnpm install
pnpm --filter @focuspocus/demo dev
```

Then open the printed URL (the nav switches between the two pages). No build of `@focuspocus/core` or `@focuspocus/reveal` is needed first; `vite.config.ts` aliases the packages to their TypeScript source.

## The point

Each page's script is ~15 lines:

```ts
import { reveal } from "@focuspocus/reveal";

// No `root` → analyzes the whole document, exactly like tabbing through the page.
const overlay = reveal();
```

Everything visual is the library's job: the numbered SVG path, the per-stop rings, the arrows, and the hover tooltips.
