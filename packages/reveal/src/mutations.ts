// The DOM attributes any rule actually reads, unioned across rules.ts. A mutation
// to anything else can't change a verdict, so it's filtered out.
const WATCHED_ATTRS = [
  "tabindex",
  "role",
  "disabled",
  "hidden",
  "inert",
  "contenteditable",
  "style",
  "class",
  "aria-hidden",
  "aria-disabled",
  "aria-label",
  "aria-labelledby",
  "title",
  "alt",
  "href",
  "type",
];

export class Mutations {
  private readonly observer: MutationObserver;
  private raf = 0;

  constructor(
    private readonly ignore: Element,
    private readonly onMutated: () => void,
  ) {
    this.observer = new MutationObserver((records) => {
      // Drop records inside our own overlay layer. Drawing badges mutates the
      // DOM, which would otherwise retrigger analysis in an endless loop.
      if (records.every((record) => this.ignore.contains(record.target))) {
        return;
      }
      this.schedule();
    });
  }

  observe(root: ParentNode): void {
    // MutationObserver needs a Node; a Document must be reduced to its root.
    const target = root.nodeType === 9 ? (root as Document).documentElement : (root as Node);
    this.observer.observe(target, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: WATCHED_ATTRS,
      characterData: true, // text changes affect accessible name
    });
  }

  destroy(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
    }
    this.observer.disconnect();
  }

  private schedule(): void {
    if (this.raf) {
      return;
    } // collapse a burst of mutations into one build per frame
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      // Our own redraw queued records during this frame; discard them so the next
      // real mutation, not the redraw, is what wakes us again.
      this.observer.takeRecords();
      this.onMutated();
    });
  }
}
