const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function requireMethod(value, name) {
  if (typeof value?.[name] !== "function") throw new TypeError(`Dialog requires ${name}()`);
}

function defaultFocusable(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    if (element.hidden || element.closest?.("[hidden], [inert], [aria-hidden='true']")) return false;
    return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
  });
}

/** Native-dialog controller with explicit focus loop and reliable restoration. */
export function createModalController({
  dialog,
  initialFocus,
  dismissOnBackdrop = true,
  getFocusable = () => defaultFocusable(dialog),
  getActiveElement = () => dialog.ownerDocument?.activeElement ?? null,
  schedule = (callback) => queueMicrotask(callback),
} = {}) {
  requireMethod(dialog, "showModal");
  requireMethod(dialog, "close");
  requireMethod(dialog, "addEventListener");
  let returnFocus = null;
  let closingReason = "close";

  function focusFirst() {
    const target = typeof initialFocus === "function" ? initialFocus() : initialFocus;
    const fallback = getFocusable()[0] ?? dialog;
    (target ?? fallback)?.focus?.({ preventScroll: true });
  }

  function open(trigger = getActiveElement()) {
    if (dialog.open) return false;
    returnFocus = trigger && typeof trigger.focus === "function" ? trigger : null;
    closingReason = "close";
    dialog.showModal();
    schedule(focusFirst);
    return true;
  }

  function close(reason = "close") {
    if (!dialog.open) return false;
    closingReason = reason;
    dialog.close(reason);
    return true;
  }

  function onCancel(event) {
    event.preventDefault?.();
    close("cancel");
  }

  function onClick(event) {
    if (dismissOnBackdrop && event.target === dialog) close("backdrop");
  }

  function onKeyDown(event) {
    if (event.key !== "Tab" || !dialog.open) return;
    const focusable = getFocusable();
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus?.({ preventScroll: true });
      return;
    }
    const active = getActiveElement();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (active === first || active === dialog || !focusable.includes(active))) {
      event.preventDefault();
      last.focus?.({ preventScroll: true });
    } else if (!event.shiftKey && (active === last || active === dialog || !focusable.includes(active))) {
      event.preventDefault();
      first.focus?.({ preventScroll: true });
    }
  }

  function onClose() {
    const target = returnFocus;
    returnFocus = null;
    schedule(() => target?.focus?.({ preventScroll: true }));
  }

  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("keydown", onKeyDown);
  dialog.addEventListener("close", onClose);

  return Object.freeze({
    open,
    close,
    isOpen: () => Boolean(dialog.open),
    lastReason: () => closingReason,
  });
}
