/**
 * Publish a completed experiment without letting an optional host integration
 * interrupt the local win flow. This module deliberately has no DOM imports so
 * the fallback and de-duplication paths can be tested in isolation.
 */

export function compatibilityPayload(detail) {
  return {
    levelId: detail.levelId,
    tier: detail.tier,
    difficulty: detail.difficulty,
    moves: detail.moves,
    par: detail.par,
    eventId: detail.eventId,
    gameId: detail.gameId,
    rewards: detail.rewards,
    achievements: detail.achievements,
  };
}

export function completionDeliveryConfirmed(profileSaved, delivery) {
  return profileSaved === true && delivery?.compatibilityReported === true;
}

function enqueueOnce(target, payload) {
  try {
    let queue = target.__realmCompletionQueue;
    if (!Array.isArray(queue)) {
      queue = [];
      target.__realmCompletionQueue = queue;
    }

    const alreadyQueued = queue.some((entry) => (
      entry?.gameId === payload.gameId
      && entry?.eventId === payload.eventId
    ));
    if (!alreadyQueued) queue.push(payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns delivery facts instead of throwing. `compatibilityReported` becomes
 * true only after RealmArcade accepts the payload or the fallback queue does.
 * The v2 CustomEvent is independent and is attempted in every case.
 */
export function publishCompletion(target, detail, eventName, options = {}) {
  const payload = compatibilityPayload(detail);
  let compatibilityReported = false;

  try {
    const complete = target?.RealmArcade?.complete;
    if (typeof complete === "function") {
      complete.call(target.RealmArcade, payload);
      compatibilityReported = true;
    }
  } catch {
    // The queue below is the compatibility path for a missing or faulty host.
  }

  if (!compatibilityReported && target) {
    compatibilityReported = enqueueOnce(target, payload);
  }

  let eventDispatched = false;
  try {
    const CustomEventConstructor = options.CustomEvent ?? target?.CustomEvent;
    if (typeof target?.dispatchEvent === "function" && typeof CustomEventConstructor === "function") {
      target.dispatchEvent(new CustomEventConstructor(eventName, { detail }));
      eventDispatched = true;
    }
  } catch {
    // Host event listeners must never prevent the game's own completion UI.
  }

  return { payload, compatibilityReported, eventDispatched };
}
