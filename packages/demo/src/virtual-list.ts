const TOTAL = 1000;
const ROW_H = 46; // px; published to CSS as --vrow-h
const OVERSCAN = 1;

function makeRow(index: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "vrow";
  row.style.top = `${index * ROW_H}px`;
  row.innerHTML =
    `<span class="vrow-idx">${index + 1}</span>` +
    `<a class="demo-link" href="#item-${index + 1}">Item ${index + 1}</a>` +
    `<button class="demo-btn" type="button" aria-label="Select item ${index + 1}">Select</button>`;
  return row;
}

export function wireVirtualList(): () => void {
  const containerEl = document.getElementById("vlist");
  const sizerEl = document.getElementById("vlist-sizer");
  if (!containerEl || !sizerEl) {
    return () => {};
  }
  const container: HTMLElement = containerEl;
  const sizer: HTMLElement = sizerEl;

  container.style.setProperty("--vrow-h", `${ROW_H}px`);
  sizer.style.height = `${TOTAL * ROW_H}px`;

  const rendered = new Map<number, HTMLElement>();

  // Smallest rendered index greater than `index`, so a new row inserts before it
  // and DOM order stays index order.
  function rowAfter(index: number): HTMLElement | null {
    let best: HTMLElement | null = null;
    let bestIndex = Infinity;
    for (const [i, el] of rendered) {
      if (i > index && i < bestIndex) {
        bestIndex = i;
        best = el;
      }
    }
    return best;
  }

  function update(): void {
    const { scrollTop, clientHeight } = container;
    const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
    const end = Math.min(TOTAL, Math.ceil((scrollTop + clientHeight) / ROW_H) + OVERSCAN);

    for (const [i, el] of rendered) {
      if (i < start || i >= end) {
        el.remove();
        rendered.delete(i);
      }
    }
    for (let i = start; i < end; i++) {
      if (rendered.has(i)) {
        continue;
      }
      const el = makeRow(i);
      rendered.set(i, el);
      sizer.insertBefore(el, rowAfter(i));
    }
  }

  let raf = 0;
  const onScroll = (): void => {
    if (raf) {
      return;
    }
    raf = requestAnimationFrame(() => {
      raf = 0;
      update();
    });
  };

  container.addEventListener("scroll", onScroll, { passive: true });
  update();

  return () => {
    if (raf) {
      cancelAnimationFrame(raf);
    }
    container.removeEventListener("scroll", onScroll);
    for (const el of rendered.values()) {
      el.remove();
    }
    rendered.clear();
  };
}
