export function restorePhotoCompletionFlags(session, storedSession) {
  const completionReported = session?.completionReported === true;
  return {
    ...session,
    completionRecorded: storedSession?.completionRecorded === true || completionReported,
    completionReported,
  };
}

export function recordPhotoCompletionOnce(state, collection, completion, recordCompletion) {
  if (
    !state?.completed
    || state.completionRecorded === true
    || typeof recordCompletion !== "function"
  ) {
    return { state, collection, recorded: false, result: null };
  }
  const result = recordCompletion(collection, completion);
  return {
    state: { ...state, completionRecorded: true },
    collection: result.progress,
    recorded: true,
    result,
  };
}

export function confirmPhotoCompletion(state, reportCompletion) {
  if (
    !state?.completed
    || state.completionRecorded !== true
    || state.completionReported === true
    || typeof reportCompletion !== "function"
  ) {
    return { state, attempted: false, succeeded: state?.completionReported === true, reward: null };
  }
  try {
    const reward = reportCompletion();
    return {
      state: { ...state, completionReported: true },
      attempted: true,
      succeeded: true,
      reward,
    };
  } catch {
    return {
      state: { ...state, completionReported: false },
      attempted: true,
      succeeded: false,
      reward: null,
    };
  }
}
