const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "iframe",
  "object",
  "embed",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Return the next wrapped index for a focus loop.
 *
 * An index outside the collection represents focus entering the loop: it
 * lands on the first item for Tab and the last item for Shift+Tab.
 */
export function nextFocusIndex(currentIndex, itemCount, backwards = false) {
  const count = Number(itemCount);
  if (!Number.isInteger(count) || count <= 0) return -1;

  const reverse = backwards === true
    || backwards === -1
    || backwards === "backward"
    || backwards === "previous"
    || backwards === "prev";
  const index = Number(currentIndex);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    return reverse ? count - 1 : 0;
  }

  return (index + (reverse ? -1 : 1) + count) % count;
}

function requireMethod(value, name) {
  if (!value || typeof value[name] !== "function") {
    throw new TypeError(`Dialog controller requires ${name}()`);
  }
}

function nodeNameIsDocumentRoot(element) {
  const name = String(element?.nodeName ?? element?.tagName ?? "").toUpperCase();
  return name === "BODY" || name === "HTML";
}

function isUsableFocusTarget(element, { allowDocumentRoot = false } = {}) {
  if (!element || typeof element.focus !== "function") return false;
  if (element.isConnected === false || element.disabled === true || element.hidden === true) return false;
  if (!allowDocumentRoot && nodeNameIsDocumentRoot(element)) return false;
  if (element.inert === true) return false;

  if (typeof element.getAttribute === "function") {
    if (element.getAttribute("aria-disabled") === "true") return false;
    if (element.getAttribute("aria-hidden") === "true") return false;
  }
  if (typeof element.matches === "function") {
    try {
      if (element.matches(":disabled")) return false;
    } catch {
      // Minimal DOM test doubles do not always implement selector parsing.
    }
  }

  if (typeof element.closest === "function") {
    if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    const ownerDialog = element.closest("dialog");
    if (ownerDialog && ownerDialog.open === false) return false;
  }

  const view = element.ownerDocument?.defaultView;
  if (typeof view?.getComputedStyle === "function") {
    const style = view.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
  }

  return true;
}

function isWithin(container, element) {
  return typeof container?.contains !== "function" || container.contains(element);
}

function isDialogDescendant(dialog, element) {
  if (!element) return false;
  if (element === dialog) return true;
  if (typeof dialog?.contains === "function") return dialog.contains(element);
  return typeof element.closest === "function" && element.closest("dialog") === dialog;
}

function focusWithoutScrolling(element, getActiveElement) {
  if (!isUsableFocusTarget(element, { allowDocumentRoot: true })) return false;
  try {
    element.focus({ preventScroll: true });
  } catch {
    return false;
  }

  // HTMLElement.focus() may silently fail. Real DOM nodes can be verified via
  // activeElement; lightweight test doubles retain the no-throw contract.
  if (!element.ownerDocument || typeof getActiveElement !== "function") return true;
  let active;
  try {
    active = getActiveElement();
  } catch {
    return true;
  }
  if (!active) return false;
  return active === element
    || (typeof element.contains === "function" && element.contains(active));
}

function defaultFocusableElements(dialog) {
  if (typeof dialog.querySelectorAll !== "function") return [];
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    if (!isUsableFocusTarget(element)) return false;
    if (typeof element.tabIndex === "number" && element.tabIndex < 0) return false;
    return isWithin(dialog, element);
  });
}

function backdropWasClicked(dialog, event) {
  if (event.target !== dialog) return false;
  if (typeof dialog.getBoundingClientRect !== "function") return true;

  const rect = dialog.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;

  return event.clientX < rect.left
    || event.clientX >= rect.right
    || event.clientY < rect.top
    || event.clientY >= rect.bottom;
}

/**
 * Wire a native <dialog> with deterministic focus trapping and restoration.
 *
 * Options accept elements, selectors, or element-returning functions for
 * `initialFocus` and `fallbackFocus`. `getFocusableElements` and
 * `getActiveElement` are injectable so the lifecycle can be tested without a
 * browser DOM. Escape/cancel and backdrop dismissal are enabled by default.
 */
export function createDialogController(options = {}) {
  const { dialog } = options;
  requireMethod(dialog, "showModal");
  requireMethod(dialog, "close");
  requireMethod(dialog, "addEventListener");
  requireMethod(dialog, "removeEventListener");

  const document = dialog.ownerDocument ?? null;
  const getActiveElement = options.getActiveElement
    ?? options.getActiveFocus
    ?? (() => document?.activeElement ?? null);
  const getReturnFocus = options.getReturnFocus ?? getActiveElement;
  const getFocusableElements = options.getFocusableElements
    ?? (options.focusableElements ? () => options.focusableElements : null)
    ?? (() => defaultFocusableElements(dialog));
  const initialFocus = options.initialFocus ?? options.primaryAction ?? null;
  const fallbackFocus = options.fallbackFocus
    ?? options.focusFallback
    ?? options.returnFocusFallback
    ?? null;
  const closeOnCancel = options.closeOnCancel
    ?? options.dismissOnCancel
    ?? options.cancelCloses
    ?? options.closeOnEscape
    ?? true;
  const closeOnEscape = options.closeOnEscape
    ?? options.dismissOnEscape
    ?? options.escapeCloses
    ?? options.closeOnCancel
    ?? true;
  const closeOnBackdrop = options.closeOnBackdrop
    ?? options.dismissOnBackdrop
    ?? options.backdropCloses
    ?? true;
  const restoreFocusByDefault = options.restoreFocus !== false;
  const onOpen = typeof options.onOpen === "function" ? options.onOpen : () => {};
  const onClose = typeof options.onClose === "function" ? options.onClose : () => {};

  let returnFocus = null;
  let sessionActive = false;
  let pendingReason = "native";
  let pendingRestore = restoreFocusByDefault;
  let destroyed = false;
  let sessionId = 0;

  function focusables() {
    const values = getFocusableElements(dialog);
    if (!values || typeof values[Symbol.iterator] !== "function") return [];
    return [...values].filter((element, index, all) => (
      all.indexOf(element) === index
      && isWithin(dialog, element)
      && isUsableFocusTarget(element)
      && !(typeof element.tabIndex === "number" && element.tabIndex < 0)
    ));
  }

  function resolveFocus(spec, { mustBeInside = false } = {}) {
    if (spec == null) return null;
    const before = getActiveElement();
    const value = typeof spec === "function"
      ? spec({ dialog, returnFocus })
      : spec;
    let element = value;

    if (typeof value === "string") {
      const scope = mustBeInside ? dialog : document;
      element = typeof scope?.querySelector === "function" ? scope.querySelector(value) : null;
    }

    if (element == null && typeof spec === "function") {
      const after = getActiveElement();
      if (
        after !== before
        && isUsableFocusTarget(after)
        && (!mustBeInside || isWithin(dialog, after))
      ) return after;
    }

    if (!isUsableFocusTarget(element)) return null;
    if (mustBeInside && !isWithin(dialog, element)) return null;
    return element;
  }

  function focusInitialTarget(override) {
    const requested = resolveFocus(override ?? initialFocus, { mustBeInside: true });
    const autofocus = override == null && initialFocus == null
      && typeof dialog.querySelector === "function"
      ? dialog.querySelector("[autofocus]")
      : null;
    const target = requested
      ?? (isUsableFocusTarget(autofocus) ? autofocus : null)
      ?? focusables()[0]
      ?? dialog;
    focusWithoutScrolling(target, getActiveElement);
  }

  function restorePreviousFocus() {
    const original = returnFocus;
    returnFocus = null;
    if (focusWithoutScrolling(original, getActiveElement)) return;

    const fallback = resolveFocus(fallbackFocus);
    if (fallback && fallback !== getActiveElement()) {
      focusWithoutScrolling(fallback, getActiveElement);
    }
  }

  function finalizeClose(reason = pendingReason, expectedSession = sessionId) {
    if (!sessionActive || expectedSession !== sessionId) return false;
    sessionActive = false;
    const shouldRestore = pendingRestore;
    pendingRestore = restoreFocusByDefault;
    pendingReason = "native";
    if (shouldRestore) restorePreviousFocus();
    else returnFocus = null;
    onClose({ dialog, reason, returnValue: dialog.returnValue });
    return true;
  }

  function closeWithReason(reason, returnValue, restoreFocus = pendingRestore) {
    if (!sessionActive && dialog.open !== true) return false;
    const closingSession = sessionId;
    pendingReason = reason;
    pendingRestore = restoreFocus;
    if (returnValue === undefined) dialog.close();
    else dialog.close(String(returnValue));

    // Browsers queue `close`; test doubles often do not emit it at all.
    // Consuming the session here makes either timing deterministic and the
    // eventual native event becomes a harmless no-op.
    finalizeClose(reason, closingSession);
    return true;
  }

  function showModal(showOptions = {}) {
    if (destroyed || dialog.open === true || sessionActive) return false;
    const active = showOptions.returnFocus ?? getReturnFocus();
    returnFocus = isUsableFocusTarget(active) && !isDialogDescendant(dialog, active) ? active : null;
    pendingReason = "native";
    pendingRestore = showOptions.restoreFocus ?? restoreFocusByDefault;
    sessionActive = true;
    sessionId += 1;

    try {
      dialog.showModal();
    } catch (error) {
      sessionActive = false;
      returnFocus = null;
      throw error;
    }

    focusInitialTarget(showOptions.initialFocus);
    onOpen({ dialog, returnFocus });
    return true;
  }

  function close(returnValue, closeOptions = {}) {
    if (returnValue && typeof returnValue === "object") {
      const config = returnValue;
      return closeWithReason(
        config.reason ?? "programmatic",
        config.returnValue,
        config.restoreFocus ?? pendingRestore,
      );
    }
    return closeWithReason(
      closeOptions.reason ?? "programmatic",
      returnValue,
      closeOptions.restoreFocus ?? pendingRestore,
    );
  }

  function onKeyDown(event) {
    if (!sessionActive || dialog.open === false) return;

    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      if (closeOnEscape) closeWithReason("escape");
      return;
    }

    if (event.key !== "Tab") return;
    const items = focusables();
    if (items.length === 0) {
      event.preventDefault();
      focusWithoutScrolling(dialog, getActiveElement);
      return;
    }
    const index = items.indexOf(getActiveElement());
    const atBoundary = index < 0
      || (event.shiftKey ? index === 0 : index === items.length - 1);
    if (!atBoundary) return;
    event.preventDefault();
    const next = nextFocusIndex(index, items.length, event.shiftKey);
    focusWithoutScrolling(items[next], getActiveElement);
  }

  function onCancel(event) {
    if (!sessionActive) return;
    event.preventDefault();
    if (closeOnCancel) closeWithReason("cancel");
  }

  function onBackdropClick(event) {
    if (sessionActive && closeOnBackdrop && backdropWasClicked(dialog, event)) {
      closeWithReason("backdrop");
    }
  }

  function onNativeClose() {
    // A queued close event from an earlier session must not consume a dialog
    // that has already been reopened.
    if (dialog.open === true) return;
    finalizeClose(pendingReason);
  }

  function destroy() {
    if (destroyed) return false;
    destroyed = true;
    dialog.removeEventListener("keydown", onKeyDown);
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("click", onBackdropClick);
    dialog.removeEventListener("close", onNativeClose);
    return true;
  }

  dialog.addEventListener("keydown", onKeyDown);
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("click", onBackdropClick);
  dialog.addEventListener("close", onNativeClose);

  return Object.freeze({
    showModal,
    show: showModal,
    open: showModal,
    close,
    destroy,
    isOpen: () => sessionActive && dialog.open !== false,
  });
}
