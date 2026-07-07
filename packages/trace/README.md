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

## API

```ts
function trace(options?: TraceOptions): TraceHandle;

interface TraceOptions {
  /** Subtree to analyze. Defaults to document. */
  root?: Document | Element;
  /** Forwarded to audit (rule toggles and custom rules). */
  audit?: AuditOptions;
  /** Motion behaviour: "auto" | "on" | "off". Defaults to "auto". */
  motion?: MotionMode;
  /** Modifier that toggles overlay click-through ("peek"). Defaults to "Alt". */
  peekKey?: ModifierKey;
  /** Mount the floating in-page control panel. Defaults to true. */
  controls?: boolean;
  /** Called after every re-analysis with the fresh result. */
  onResult?: (result: AuditResult) => void;
  /** Called whenever visibility or peek flips, whatever flipped it. */
  onStateChange?: (state: { visible: boolean; peeking: boolean }) => void;
}

interface TraceHandle {
  /** Whether the overlay is currently shown. */
  readonly visible: boolean;
  /** Whether the overlay is currently click-through ("peek"). */
  readonly peeking: boolean;
  /** Show or hide the whole overlay: badges, arrows, and the element rings. */
  setVisible(visible: boolean): void;
  /** Flip between shown and hidden. */
  toggle(): void;
  /** Turn peek (click-through) on or off. Ignored while the overlay is hidden. */
  setPeek(peek: boolean): void;
  /** Switch the motion behaviour. */
  setMotion(mode: MotionMode): void;
  /** Remove the overlay layer, observers, and listeners. */
  destroy(): void;
  /** Latest analysis result, or null before the first draw. */
  result: AuditResult | null;
}
```

The overlay re-analyzes itself on DOM mutation, so most pages need nothing
beyond the mount.
