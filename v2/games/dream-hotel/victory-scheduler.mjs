/** Cancelable, generation-guarded deferred victory presentation. */
export function createVictoryScheduler({
  readContext,
  onShow,
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (handle) => clearTimeout(handle),
} = {}) {
  if (typeof readContext !== "function" || typeof onShow !== "function") {
    throw new TypeError("Victory scheduler requires readContext() and onShow()");
  }
  let timer = null;

  function cancel() {
    if (timer === null) return false;
    clearTimer(timer);
    timer = null;
    return true;
  }

  function schedule(payload, delay = 220) {
    cancel();
    const expected = { ...readContext() };
    timer = setTimer(() => {
      timer = null;
      const current = readContext();
      if (current.generation !== expected.generation
          || current.levelId !== expected.levelId
          || current.completed !== true) return;
      onShow(payload);
    }, delay);
    return { ...expected };
  }

  return Object.freeze({
    schedule,
    cancel,
    pending: () => timer !== null,
  });
}
