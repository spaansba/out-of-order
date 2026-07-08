export function leadingThrottle(
  fn: () => void,
  interval: number,
): { call: () => void; cancel: () => void } {
  let cooldown = 0;
  let pending = false;
  const call = (): void => {
    if (cooldown) {
      pending = true;
      return;
    }
    fn();
    cooldown = window.setTimeout(() => {
      cooldown = 0;
      if (pending) {
        pending = false;
        call();
      }
    }, interval);
  };
  return { call, cancel: () => clearTimeout(cooldown) };
}

// CSS anchor-name only takes effect on elements that generate a principal CSS
// box. SVG layout elements (and other non-HTML content) don't, so anchoring a
// badge to one silently no-ops; those badges and any hop touching them are
// placed from live geometry instead.
export function needsManualPlacement(element: Element): boolean {
  return !(element instanceof HTMLElement);
}

/** document.activeElement stops at a shadow host; descend the activeElement
    chain so focus inside an open shadow root resolves to the real element. */
export function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}
