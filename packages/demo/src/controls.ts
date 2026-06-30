// Shared demo chrome: wire the top-bar "Hide overlay" toggle to one or more
// overlays. Both demo pages use this; only their overlay set differs. (No
// re-analyze control: the overlay re-analyzes itself on every DOM mutation.)
// Returns a teardown that detaches the listener, so an HMR re-run rewires the
// (persistent) toggle once instead of stacking duplicate handlers.
import type { RevealHandle } from "@focuspocus/reveal";

export function wireOverlayControls(overlays: RevealHandle[]): () => void {
  const toggle = document.getElementById("toggle") as HTMLButtonElement | null;
  if (!toggle) {
    return () => {};
  }
  let visible = true;
  const onClick = (): void => {
    visible = !visible;
    for (const overlay of overlays) {
      overlay.setVisible(visible);
    }
    toggle.textContent = visible ? "Hide overlay" : "Show overlay";
  };
  toggle.addEventListener("click", onClick);
  return () => toggle.removeEventListener("click", onClick);
}

export function wireTopbarOffset(): () => void {
  const topbar = document.querySelector<HTMLElement>(".topbar");
  if (!topbar) {
    return () => {};
  }
  const sync = (): void => {
    document.documentElement.style.setProperty(
      "--topbar-h",
      `${topbar.offsetHeight - 1}px`,
    );
  };
  sync();
  const observer = new ResizeObserver(sync);
  observer.observe(topbar);
  return () => {
    observer.disconnect();
    document.documentElement.style.removeProperty("--topbar-h");
  };
}
