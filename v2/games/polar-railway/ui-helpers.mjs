export const COMPLETION_EVENT = "ten-realms-v2:game-complete";
export const STORAGE_PREFIX = "ten-realms-v2:games:polar-railway:";
export const DIFFICULTY_TIERS = Object.freeze({ easy: 1, medium: 2, hard: 3 });

export const STORAGE_KEYS = Object.freeze({
  save: `${STORAGE_PREFIX}save:v1`,
  preferences: `${STORAGE_PREFIX}preferences:v1`,
  records: `${STORAGE_PREFIX}records:v1`,
  tutorial: `${STORAGE_PREFIX}tutorial:v1`,
});

export const TUTORIAL_SLIDES = Object.freeze([
  Object.freeze({
    id: "elements",
    image: "./assets/tutorial-elements.svg",
    eyebrow: "01 · 看懂调度图",
    title: "配额、预置轨与两种笔记",
    copy: "上方是每列配额，右侧是每行配额；黄铜轨是不可改的预置。蓝色候选只表示“这里有轨”，叉号表示排除。",
  }),
  Object.freeze({
    id: "operation",
    image: "./assets/tutorial-operation.svg",
    eyebrow: "02 · 铺设与排除",
    title: "连选相邻格，决定列车方向",
    copy: "选“铺轨边”后依次点两个相邻格；“排除边”同理标叉。格心工具用于批量推理，候选不会替代真正方向。",
  }),
  Object.freeze({
    id: "goal",
    image: "./assets/tutorial-goal.svg",
    eyebrow: "03 · 准点抵达",
    title: "补成唯一一条 A 到 B 的线路",
    copy: "每个轨道格恰好两条连接，配额全部吻合；不能交叉、分叉、断头、成环或留下游离轨段。",
  }),
]);

export function createModalController(dialog, { focusTarget, onClosed } = {}) {
  if (!dialog || typeof dialog.addEventListener !== "function") {
    throw new TypeError("A dialog-like EventTarget is required");
  }
  let opener = null;

  function open(source = null) {
    if (dialog.open) return false;
    opener = source ?? dialog.ownerDocument?.activeElement ?? null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.open = true;
    const target = typeof focusTarget === "function" ? focusTarget() : focusTarget;
    target?.focus?.({ preventScroll: true });
    return true;
  }

  function close(returnValue = "") {
    if (!dialog.open) return false;
    if (typeof dialog.close === "function") dialog.close(returnValue);
    else {
      dialog.open = false;
      dialog.dispatchEvent?.(new Event("close"));
    }
    return true;
  }

  dialog.addEventListener("close", () => {
    const target = opener;
    opener = null;
    target?.focus?.({ preventScroll: true });
    onClosed?.(dialog.returnValue ?? "");
  });

  return Object.freeze({ open, close, isOpen: () => Boolean(dialog.open) });
}

export function makeCompletionEnvelope({
  puzzle,
  completionId,
  attemptId,
  moves,
  elapsedMs,
  undoCount,
  restartCount,
  zeroRework,
  onTime,
  rewardIds,
  rewards = [],
  completedAt,
}) {
  return Object.freeze({
    schema: "ten-realms-v2.game-complete",
    version: 1,
    gameId: "polar-railway",
    completionId,
    attemptId,
    puzzleId: puzzle.id,
    puzzleTitle: puzzle.title,
    levelId: puzzle.id,
    difficulty: puzzle.difficulty,
    tier: DIFFICULTY_TIERS[puzzle.difficulty] ?? 1,
    moves,
    par: puzzle.parMoves,
    elapsedMs,
    undoCount,
    restartCount,
    zeroRework,
    onTime,
    rewardIds: Object.freeze([...rewardIds]),
    rewards: Object.freeze(rewards.map(({ id, label, unlocked }) => Object.freeze({ id, label, unlocked }))),
    completedAt,
  });
}

const COMPLETION_SCHEMA = "ten-realms-v2.game-complete";
const REWARD_KINDS = new Set(["route", "badge", "engine", "carriage"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Rebuild a persisted completion as a frozen envelope only when every field
 * still belongs to the restored puzzle and attempt. This lets an interrupted
 * shared-reward delivery retry with the exact original reward snapshot.
 */
export function restoreCompletionEnvelope(value, { puzzle, attemptId } = {}) {
  const expectedCompletionId = typeof attemptId === "string" ? `polar-railway:${attemptId}` : "";
  const rewardIds = value?.rewardIds;
  const rewards = value?.rewards;
  const boundedInteger = (item, maximum = 10_000_000) => Number.isSafeInteger(item) && item >= 0 && item <= maximum;
  const validRewardIds = Array.isArray(rewardIds) && rewardIds.length <= 64
    && rewardIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 160)
    && new Set(rewardIds).size === rewardIds.length;
  const validRewards = Array.isArray(rewards) && rewards.length === rewardIds?.length && rewards.length <= 64
    && rewards.every((reward, index) => isPlainObject(reward)
      && reward.id === rewardIds[index]
      && typeof reward.label === "string" && reward.label.length > 0 && reward.label.length <= 160
      && REWARD_KINDS.has(reward.unlocked));
  if (!isPlainObject(value) || !isPlainObject(puzzle)
      || value.schema !== COMPLETION_SCHEMA || value.version !== 1 || value.gameId !== "polar-railway"
      || value.completionId !== expectedCompletionId || value.attemptId !== attemptId
      || value.puzzleId !== puzzle.id || value.levelId !== puzzle.id || value.puzzleTitle !== puzzle.title
      || value.difficulty !== puzzle.difficulty || value.tier !== (DIFFICULTY_TIERS[puzzle.difficulty] ?? 1)
      || value.par !== puzzle.parMoves || !boundedInteger(value.moves)
      || !boundedInteger(value.elapsedMs, 31_536_000_000)
      || !boundedInteger(value.undoCount) || !boundedInteger(value.restartCount)
      || typeof value.zeroRework !== "boolean" || typeof value.onTime !== "boolean"
      || typeof value.completedAt !== "string" || value.completedAt.length > 64
      || !Number.isFinite(Date.parse(value.completedAt)) || !validRewardIds || !validRewards) return null;
  return makeCompletionEnvelope({
    puzzle,
    completionId: value.completionId,
    attemptId,
    moves: value.moves,
    elapsedMs: value.elapsedMs,
    undoCount: value.undoCount,
    restartCount: value.restartCount,
    zeroRework: value.zeroRework,
    onTime: value.onTime,
    rewardIds,
    rewards,
    completedAt: value.completedAt,
  });
}

/**
 * A completion is confirmed only after the host accepts it or the exact
 * completion id is observable in the fallback queue. All queue operations are
 * guarded because hosts may expose a frozen or non-writable bridge property.
 */
export function deliverCompletion(target, payload) {
  const failure = Object.freeze({ delivered: false, channel: null });
  if ((!target || (typeof target !== "object" && typeof target !== "function"))
      || !isPlainObject(payload) || typeof payload.completionId !== "string" || !payload.completionId) return failure;
  try {
    if (typeof target.RealmArcade?.complete === "function") {
      target.RealmArcade.complete(payload);
      return Object.freeze({ delivered: true, channel: "api" });
    }
  } catch {
    // A throwing host still gets the same id through the local pending queue.
  }
  try {
    let queue = target.__realmCompletionQueue;
    if (!Array.isArray(queue)) {
      target.__realmCompletionQueue = [];
      queue = target.__realmCompletionQueue;
    }
    if (!Array.isArray(queue)) return failure;
    if (!queue.some((item) => item?.completionId === payload.completionId)) queue.push(payload);
    const confirmedQueue = target.__realmCompletionQueue;
    const delivered = Array.isArray(confirmedQueue)
      && confirmedQueue.some((item) => item?.completionId === payload.completionId);
    return delivered ? Object.freeze({ delivered: true, channel: "queue" }) : failure;
  } catch {
    return failure;
  }
}

export function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable);
}
