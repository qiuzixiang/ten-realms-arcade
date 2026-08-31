function requireMethod(value, name) {
  if (!value || typeof value[name] !== "function") {
    throw new TypeError(`Victory dialog requires ${name}()`);
  }
}

export function createVictoryDialogController(options = {}) {
  const {
    dialog,
    primaryAction,
    dismissAction,
    getReturnFocus = () => null,
    getActiveFocus = () => dialog?.ownerDocument?.activeElement,
    focusFallback = () => {},
    onDismiss = () => {},
  } = options;

  requireMethod(dialog, "showModal");
  requireMethod(dialog, "close");
  requireMethod(dialog, "addEventListener");
  requireMethod(primaryAction, "focus");
  requireMethod(dismissAction, "addEventListener");

  let returnFocus = null;
  let restoreAfterClose = false;

  function restoreFocus() {
    const target = returnFocus;
    returnFocus = null;
    if (target?.isConnected !== false && typeof target?.focus === "function") {
      target.focus({ preventScroll: true });
    } else {
      focusFallback();
    }
  }

  function onClose() {
    const shouldRestore = restoreAfterClose;
    restoreAfterClose = false;
    if (shouldRestore) restoreFocus();
    else returnFocus = null;
  }

  function close({ dismiss = false, restoreFocus: shouldRestore = false } = {}) {
    if (!dialog.open) return false;
    restoreAfterClose = shouldRestore;
    if (dismiss) onDismiss();
    dialog.close();
    // Native `close` is queued in some browsers. Restore deterministically
    // now; the eventual event is harmless because onClose consumes its state.
    onClose();
    return true;
  }

  function dismiss() {
    return close({ dismiss: true, restoreFocus: true });
  }

  function onCancel(event) {
    event.preventDefault();
    dismiss();
  }

  function onKeyDown(event) {
    if (event.key !== "Tab" || !dialog.open) return;
    const active = getActiveFocus();
    if (event.shiftKey && (active === primaryAction || active === dialog)) {
      event.preventDefault();
      dismissAction.focus({ preventScroll: true });
    } else if (!event.shiftKey && (active === dismissAction || active === dialog)) {
      event.preventDefault();
      primaryAction.focus({ preventScroll: true });
    }
  }

  function show() {
    if (dialog.open) return false;
    returnFocus = getReturnFocus();
    restoreAfterClose = false;
    dialog.showModal();
    primaryAction.focus({ preventScroll: true });
    return true;
  }

  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("close", onClose);
  dialog.addEventListener("keydown", onKeyDown);
  dismissAction.addEventListener("click", dismiss);

  return Object.freeze({ show, close, dismiss });
}
