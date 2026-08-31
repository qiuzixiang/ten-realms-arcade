export function compatibilityPayload(detail) {
  return Object.freeze({
    game: detail.game,
    realm: detail.game,
    levelId: detail.levelId,
    tier: detail.tier,
    moves: detail.moves,
    par: detail.par,
    completionId: detail.completionId,
    mistakes: detail.mistakes,
    rewardIds: Object.freeze([...(detail.rewardIds ?? [])]),
  });
}

export function reportCompatibilityCompletion(target, detail) {
  const payload = compatibilityPayload(detail);
  if (typeof target?.RealmArcade?.complete === "function") {
    try {
      target.RealmArcade.complete(payload);
      return Object.freeze({ delivered: true, queued: false, payload });
    } catch {
      // A late-loading or temporarily unavailable adapter falls through to
      // the stable-id queue. The caller keeps a durable pending receipt too.
    }
  }

  let queue;
  try {
    queue = target?.__realmCompletionQueue;
    if (queue === undefined && target) {
      target.__realmCompletionQueue = [];
      queue = target.__realmCompletionQueue;
    }
  } catch {
    return Object.freeze({ delivered: false, queued: false, payload });
  }
  if (!Array.isArray(queue)) return Object.freeze({ delivered: false, queued: false, payload });

  const alreadyQueued = queue.some((entry) => entry?.completionId === payload.completionId);
  if (!alreadyQueued) queue.push(payload);
  return Object.freeze({ delivered: false, queued: true, payload });
}
