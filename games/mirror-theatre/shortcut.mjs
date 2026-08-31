export function shouldHandleGlobalShortcut(context = {}) {
  if (context.dialogOpen) return false;

  const key = String(context.key ?? "").toLowerCase();
  const isUndo = Boolean(context.ctrlKey || context.metaKey) && key === "z";
  if (isUndo) return true;

  return !context.targetIsStageCell;
}

export function shouldRestoreDifficultyFocus(context = {}) {
  return context.clickDetail === 0 && context.buttonHadFocus === true;
}
