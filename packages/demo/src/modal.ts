const modalId = "modal-demo";

/** The page behind the modal: every body-level element that should go inert while
    it's open. The modal itself and the overlay's own layer(s) are body-level
    siblings, left untouched (the overlay must keep drawing; the dialog reachable). */
function background(): Element[] {
  return Array.from(document.body.children).filter(
    (element) =>
      element.id !== modalId &&
      !element.hasAttribute("data-focuspocus-overlay") &&
      element.tagName !== "SCRIPT",
  );
}

let trapsFocus = false;

function applyInert(): void {
  const modal = document.getElementById(modalId);
  const open = !!modal && !modal.hasAttribute("hidden");
  for (const element of background()) {
    element.toggleAttribute("inert", open && trapsFocus);
  }
}

function setOpen(open: boolean): void {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }
  modal.toggleAttribute("hidden", !open);
  applyInert();
}

/** Solve/Revert for card K: wire (or unwire) the modal to trap focus. Re-applies
    immediately so toggling it while the dialog is open takes effect at once. */
export function setModalTrapsFocus(enabled: boolean): void {
  trapsFocus = enabled;
  applyInert();
}

export function wireModal(): () => void {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return () => {};
  }
  const open = (): void => setOpen(true);
  const close = (): void => setOpen(false);
  const openBtn = document.getElementById("open-modal");
  const closers = Array.from(
    modal.querySelectorAll<HTMLElement>("[data-close]"),
  );
  openBtn?.addEventListener("click", open);
  for (const btn of closers) {
    btn.addEventListener("click", close);
  }
  return () => {
    openBtn?.removeEventListener("click", open);
    for (const btn of closers) {
      btn.removeEventListener("click", close);
    }
  };
}
