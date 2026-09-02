import {
  completionOutboxStorageKey,
  gameStorageKey,
  readStoredJson,
  readStoredValue,
  tutorialStorageKey,
  writeStoredJson,
  writeStoredValue,
} from "./storage.mjs";
import { acknowledgeCompletion, buildCompletionPayload, enqueueCompletion, normalizeCompletionOutbox } from "./completion-outbox.mjs";

const $ = (selector, root = document) => root.querySelector(selector);

function safeId() {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

function stableRunId(value) {
  return typeof value === "string" && /^[a-z0-9-]{6,96}$/i.test(value) ? value : safeId();
}

function openDialog(dialog, focusSelector) {
  if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  $(focusSelector, dialog)?.focus({ preventScroll: true });
}

function closeDialog(dialog) {
  if (dialog.open && typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

/**
 * A deliberately small, version-isolated shell shared by the ten V4 games.
 * Rule modules remain pure: they own the board state and return new states;
 * this shell only owns local persistence, native tutorial controls and the
 * idempotent bridge to the V4 progress host.
 */
export function mountPuzzle(config) {
  const {
    slug, title, eyebrow = "FOURTH EXPEDITION", summary, accent = "#70f0d0",
    rules = [], levelId = "practice", tier = 1, par = null,
    freshState, normalizeState, isComplete, renderBoard, statusFor,
    tutorialCards, hint,
  } = config ?? {};
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug ?? "")) throw new TypeError("A stable V4 slug is required.");
  if (typeof freshState !== "function" || typeof normalizeState !== "function" || typeof isComplete !== "function" || typeof renderBoard !== "function") {
    throw new TypeError("V4 game kit requires pure state and renderer functions.");
  }

  const sessionKey = gameStorageKey(slug, "session", 1);
  const outboxKey = completionOutboxStorageKey(slug, 1);
  const outboxContext = Object.freeze({ realm: slug, levelId, tier, par });
  const guideKey = tutorialStorageKey(slug, 1);
  let session = readSession();
  let completionOutbox = readCompletionOutbox();
  let tutorialIndex = 0;
  let toastTimer = 0;

  document.documentElement.style.setProperty("--game-accent", accent);
  document.body.classList.add("v4-game-body");
  document.body.innerHTML = `
    <header class="v4-game-header">
      <a href="../../" aria-label="返回十境谜游馆 4.0"><span aria-hidden="true">◈</span><b>十境谜游馆</b><small>4.0</small></a>
      <div><button type="button" id="tutorial-button">图片教程</button><button type="button" id="restart-button">重新开始</button></div>
    </header>
    <main class="v4-game-main">
      <section class="v4-game-hero"><p>${eyebrow}</p><h1>${title}</h1><span>${summary ?? ""}</span></section>
      <section class="v4-play-panel" aria-label="${title} 游戏棋盘">
        <header><div><p data-status-title></p><small data-status-copy></small></div><div class="v4-stat"><b data-moves>0</b><small>操作</small></div></header>
        <div class="v4-board-wrap"><div class="v4-board" data-board></div></div>
        <p class="v4-board-help" data-board-help></p>
      </section>
      <section class="v4-rule-panel"><h2>任务准则</h2><ol>${rules.map((rule) => `<li><b>${rule.title}</b><span>${rule.copy}</span></li>`).join("")}</ol></section>
    </main>
    <footer class="v4-game-footer">规则参考 Simon Tatham's Portable Puzzle Collection · 本局进度仅保存于此浏览器</footer>
    <dialog class="v4-native-dialog" id="guide-dialog" aria-labelledby="guide-title">
      <div class="v4-native-dialog__shell"><header><div><small data-guide-tag></small><h2 id="guide-title"></h2></div><button type="button" data-guide-skip>跳过</button></header>
      <div class="v4-guide-art" data-guide-art></div><p data-guide-copy></p><ul data-guide-bullets></ul>
      <footer><span data-guide-count></span><button type="button" data-guide-next>下一张</button></footer></div>
    </dialog>
    <dialog class="v4-native-dialog v4-win-dialog" id="victory-dialog" aria-labelledby="victory-title">
      <div class="v4-native-dialog__shell"><header><div><small>REALM CLEARED</small><h2 id="victory-title">航线已校准</h2></div><button type="button" data-victory-close aria-label="关闭">×</button></header>
      <div class="v4-victory-mark" aria-hidden="true">✦</div><p data-victory-copy></p><footer><span data-victory-moves></span><button type="button" data-victory-restart>再挑战一次</button></footer></div>
    </dialog>
    <div class="v4-local-toast" role="status" aria-live="polite" data-toast></div>`;

  const board = $("[data-board]");
  const guide = $("#guide-dialog");
  const victory = $("#victory-dialog");
  $("#tutorial-button").addEventListener("click", () => openGuide(false));
  $("#restart-button").addEventListener("click", restart);
  $("[data-guide-skip]").addEventListener("click", () => closeGuide(true));
  $("[data-guide-next]").addEventListener("click", () => {
    const cards = cardsForGuide();
    if (tutorialIndex < cards.length - 1) { tutorialIndex += 1; renderGuide(); }
    else closeGuide(true);
  });
  $("[data-victory-close]").addEventListener("click", () => closeDialog(victory));
  $("[data-victory-restart]").addEventListener("click", () => { closeDialog(victory); restart(); });
  guide.addEventListener("cancel", (event) => { event.preventDefault(); closeGuide(true); });
  victory.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(victory); });
  window.addEventListener("ten-realms-v4:realm-ready", (event) => {
    if (event.detail?.realm === slug) flushCompletionOutbox();
  });

  ensureCompletedSessionIsQueued();
  render();
  flushCompletionOutbox();
  if (readStoredValue(guideKey) !== "seen") window.setTimeout(() => openGuide(true), 360);

  function readSession() {
    const candidate = readStoredJson(sessionKey, null);
    const state = normalizeState(candidate?.state);
    if (state) return {
      version: 1,
      runId: stableRunId(candidate?.runId),
      state,
      completed: candidate.completed === true && isComplete(state),
      completionDelivered: candidate.completed === true && isComplete(state) && candidate.completionDelivered === true,
    };
    return { version: 1, runId: safeId(), state: freshState(), completed: false, completionDelivered: false };
  }

  function persist() { writeStoredJson(sessionKey, session); }

  function render() {
    const overview = statusFor?.(session.state, session.completed) ?? { title: "继续校准", copy: "完成所有规则目标即可通关。", help: "点击棋盘中的可交互元素。" };
    $("[data-status-title]").textContent = overview.title;
    $("[data-status-copy]").textContent = overview.copy;
    $("[data-board-help]").textContent = overview.help ?? "点击棋盘中的可交互元素。";
    $("[data-moves]").textContent = String(Math.max(0, Number(session.state.moves) || 0));
    board.replaceChildren();
    renderBoard({
      board,
      state: session.state,
      completed: session.completed,
      commit,
      toast,
      hint: () => hint?.(session.state, commit, toast),
    });
  }

  function commit(nextState, message = "状态已更新") {
    const clean = normalizeState(nextState);
    if (!clean) { toast("这一步不能改变局面"); return false; }
    session = { ...session, state: clean };
    if (!session.completed && isComplete(clean)) {
      session = { ...session, completed: true, completionDelivered: false };
      persist(); // The local completion flag is durable before any host callback.
      render();
      queueCompletion();
      showVictory();
      return true;
    }
    persist();
    render();
    toast(message);
    return true;
  }

  function restart() {
    session = { version: 1, runId: safeId(), state: freshState(), completed: false, completionDelivered: false };
    persist();
    render();
    toast("已恢复这座世界的初始局面");
  }

  function toast(message) {
    const node = $("[data-toast]");
    window.clearTimeout(toastTimer);
    node.textContent = message;
    node.classList.add("is-visible");
    toastTimer = window.setTimeout(() => node.classList.remove("is-visible"), 2500);
  }

  function cardsForGuide() {
    const cards = tutorialCards?.();
    return Array.isArray(cards) && cards.length >= 3 ? cards : [];
  }

  function renderGuide() {
    const cards = cardsForGuide();
    const card = cards[tutorialIndex] ?? cards[0];
    if (!card) return;
    $("[data-guide-tag]").textContent = card.tag ?? `0${tutorialIndex + 1} · 图片教程`;
    $("#guide-title").textContent = card.title ?? "认识规则";
    $("[data-guide-art]").innerHTML = card.svg;
    $("[data-guide-copy]").textContent = card.body ?? "";
    $("[data-guide-bullets]").replaceChildren(...(card.bullets ?? []).map((text) => {
      const item = document.createElement("li"); item.textContent = text; return item;
    }));
    $("[data-guide-count]").textContent = `${tutorialIndex + 1} / ${cards.length}`;
    $("[data-guide-next]").textContent = tutorialIndex === cards.length - 1 ? "开始游戏" : "下一张";
    guide.scrollTop = 0;
  }

  function openGuide(auto) {
    if (victory.open || guide.open) return;
    tutorialIndex = 0;
    renderGuide();
    if (!cardsForGuide().length) { if (!auto) toast("教程正在校对中"); return; }
    openDialog(guide, "[data-guide-next]");
  }

  function closeGuide(markSeen) {
    if (markSeen) writeStoredValue(guideKey, "seen");
    closeDialog(guide);
    $("#tutorial-button").focus({ preventScroll: true });
  }

  function completionPayload() {
    return buildCompletionPayload({
      realm: slug,
      levelId,
      tier,
      moves: Math.max(0, Number(session.state.moves) || 0),
      par,
      runId: session.runId,
    });
  }

  function readCompletionOutbox() {
    return normalizeCompletionOutbox(readStoredJson(outboxKey, []), outboxContext);
  }

  function persistCompletionOutbox() {
    return writeStoredJson(outboxKey, completionOutbox);
  }

  function ensureCompletedSessionIsQueued() {
    if (!session.completed || session.completionDelivered) return;
    const payload = completionPayload();
    if (!payload) return;
    completionOutbox = enqueueCompletion(completionOutbox, payload, outboxContext);
    persistCompletionOutbox();
  }

  function queueCompletion() {
    const payload = completionPayload();
    if (!payload) { toast("通关记录无法安全结算，请重新开始本局"); return; }
    completionOutbox = enqueueCompletion(completionOutbox, payload, outboxContext);
    // The outbox is durable before the host is called, so a reload cannot
    // silently discard a just-completed run while the shared UI is loading.
    persistCompletionOutbox();
    flushCompletionOutbox();
  }

  function flushCompletionOutbox() {
    const host = window.TenRealmsV4;
    if (!completionOutbox.length || host?.realm !== slug || typeof host.complete !== "function") return false;
    let delivered = false;
    for (const payload of [...completionOutbox]) {
      try {
        host.complete(payload);
        if (payload.eventId === completionPayload()?.eventId && !session.completionDelivered) {
          session = { ...session, completionDelivered: true };
          persist();
        }
        completionOutbox = acknowledgeCompletion(completionOutbox, payload.eventId, outboxContext);
        delivered = true;
      } catch {
        // Keep the canonical payload for a later ready event or page reload.
      }
    }
    if (delivered) persistCompletionOutbox();
    return completionOutbox.length === 0;
  }

  function showVictory() {
    $("[data-victory-moves]").textContent = `本次用时 ${Math.max(0, Number(session.state.moves) || 0)} 次操作`;
    $("[data-victory-copy]").textContent = par === null
      ? "所有必要条件都已同时成立。结算已安全写入本机，刷新不会重复累计奖励。"
      : `所有必要条件都已同时成立。建议步数为 ${par}；再次挑战可争取更高效率奖励。`;
    window.setTimeout(() => { if (!guide.open) openDialog(victory, "[data-victory-restart]"); }, 180);
  }

  return Object.freeze({ commit, restart, getState: () => session.state, openGuide: () => openGuide(false) });
}
