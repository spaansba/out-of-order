export type MotionMode = "auto" | "on" | "off";

export interface MotionControl {
  setMode(mode: MotionMode): void;
  teardown(): void;
}

// Reflect the motion setting onto the layer, honouring prefers-reduced-motion in
// "auto". Owns the media-query listener so a system change re-applies live.
export function setupMotion(layer: HTMLElement, initial: MotionMode): MotionControl {
  let motion = initial;
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ac = new AbortController();
  const apply = (): void => {
    const animate = motion === "on" || (motion === "auto" && !reduceQuery.matches);
    layer.dataset.oooMotion = animate ? "play" : "still";
  };
  apply();
  reduceQuery.addEventListener("change", apply, { signal: ac.signal });

  return {
    setMode(mode) {
      motion = mode;
      apply();
    },
    teardown: () => ac.abort(),
  };
}
