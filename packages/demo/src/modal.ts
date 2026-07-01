const modalId = "modal-demo";
const nativeId = "modal-demo-native";

let useNative = false;
let isOpen = false;

function overlay(): HTMLElement | null {
  return document.getElementById(modalId);
}

// The native counterpart of the custom overlay, built lazily and reused. Same
// content, but a real <dialog> so the fix can open it with showModal().
function nativeDialog(): HTMLDialogElement {
  const existing = document.getElementById(nativeId) as HTMLDialogElement | null;
  if (existing) {
    return existing;
  }
  const dialog = document.createElement("dialog");
  dialog.id = nativeId;
  dialog.className = "dialog modal-native";
  dialog.setAttribute("aria-label", "Confirm deletion");
  dialog.innerHTML =
    "<strong>Delete this item?</strong>" +
    '<div class="row">' +
    '<button class="demo-btn" type="button" data-close>Cancel</button>' +
    '<button class="demo-btn" type="button" data-close>Delete</button>' +
    "</div>";
  for (const btn of dialog.querySelectorAll("[data-close]")) {
    btn.addEventListener("click", () => setOpen(false));
  }
  document.body.appendChild(dialog);
  return dialog;
}

function render(): void {
  const box = overlay();
  if (useNative) {
    box?.setAttribute("hidden", "");
    const dialog = nativeDialog();
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
    return;
  }
  const dialog = document.getElementById(nativeId) as HTMLDialogElement | null;
  if (dialog?.open) {
    dialog.close();
  }
  box?.toggleAttribute("hidden", !isOpen);
}

function setOpen(open: boolean): void {
  isOpen = open;
  render();
}

// A native <dialog>.showModal() traps focus for real, yet the analyzer still flags
// focus-escapes-modal: the false positive this card exists to show.
export function setModalUsesNativeDialog(enabled: boolean): void {
  useNative = enabled;
  render();
}

export function wireModal(): () => void {
  const box = overlay();
  if (!box) {
    return () => {};
  }
  const open = (): void => setOpen(true);
  const close = (): void => setOpen(false);
  const openBtn = document.getElementById("open-modal");
  const closers = Array.from(box.querySelectorAll<HTMLElement>("[data-close]"));
  openBtn?.addEventListener("click", open);
  for (const btn of closers) {
    btn.addEventListener("click", close);
  }
  return () => {
    openBtn?.removeEventListener("click", open);
    for (const btn of closers) {
      btn.removeEventListener("click", close);
    }
    document.getElementById(nativeId)?.remove();
    useNative = false;
    isOpen = false;
  };
}
