/**
 * A cancellable, revision-guarded delay for outcome dialogs. Keeping this
 * separate from the DOM makes the stale-completion race directly testable.
 */
export function createDialogScheduler(options = {}) {
  const scheduleTimer = options.scheduleTimer ?? ((callback, delay) => setTimeout(callback, delay));
  const cancelTimer = options.cancelTimer ?? ((handle) => clearTimeout(handle));
  let handle = null;
  let revision = 0;

  function cancel() {
    revision += 1;
    if (handle !== null) cancelTimer(handle);
    handle = null;
  }

  function schedule(delay, isCurrent, open) {
    cancel();
    const scheduledRevision = revision;
    handle = scheduleTimer(() => {
      handle = null;
      if (scheduledRevision !== revision || !isCurrent()) return;
      open();
    }, Math.max(0, Number(delay) || 0));
  }

  return Object.freeze({ cancel, schedule });
}
