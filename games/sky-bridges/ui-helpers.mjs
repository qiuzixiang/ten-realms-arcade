export function shouldRestoreDifficultyFocus({ eventDetail, pointerType } = {}) {
  if (pointerType === "touch" || pointerType === "pen") return false;
  return eventDetail === 0 || pointerType === "mouse";
}
