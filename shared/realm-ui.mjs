import {
  awardCompletion,
  badgeRulesForRealm,
  createProgress,
  mergeProgress,
  normalizeProgress,
  progressSummary,
  RANKS,
} from "./reward-engine.mjs";
import { REALM_TUTORIALS, tutorialArt } from "./tutorial-data.mjs?v=2";

const STORAGE_KEY = "ten-realms:progress:v1";
// Bump when the visual language or rules shown by the cards materially change.
// Version 2 replaces several schematic drawings with in-game state replicas and
// fixes the narrow-screen dialog alignment, so returning players should see it once.
const TUTORIAL_VERSION = 2;
const ACCENTS = Object.freeze({
  "star-drift": ["#79e7ff", "121, 231, 255"],
  "memory-ark": ["#aeb8ff", "174, 184, 255"],
  "red-thread-office": ["#ff7898", "255, 120, 152"],
  "firefly-garden": ["#ddff82", "221, 255, 130"],
  "abyss-echo": ["#68ddff", "104, 221, 255"],
  "storm-lanterns": ["#ffd76e", "255, 215, 110"],
  "night-market-spirits": ["#d6a6ff", "214, 166, 255"],
  "sky-bridges": ["#77d7ff", "119, 215, 255"],
  "spirit-dragon": ["#8dd3aa", "141, 211, 170"],
  "mirror-theatre": ["#d2b6ff", "210, 182, 255"],
});

function detectRealm() {
  const explicit = document.documentElement.dataset.realm;
  if (explicit && REALM_TUTORIALS[explicit]) return explicit;
  const segments = window.location.pathname.split("/").filter(Boolean);
  const gamesIndex = segments.lastIndexOf("games");
  const candidate = gamesIndex >= 0 ? segments[gamesIndex + 1] : "";
  return REALM_TUTORIALS[candidate] ? candidate : "";
}

const realmId = detectRealm();
const tutorial = REALM_TUTORIALS[realmId];

if (tutorial) {
  const [accent, accentRgb] = ACCENTS[realmId] ?? ACCENTS["star-drift"];
  const badgeRules = badgeRulesForRealm(realmId);
  let currentCard = 0;
  let lastFocus = null;
  let tutorialWaitObserver = null;
  let toastTimer = 0;
  let toastRevealTimer = 0;
  let toastHideTimer = 0;
  let progress = loadProgress();

  ensureStylesheet();
  const dock = buildDock();
  const guide = buildGuide();
  const rewards = buildRewards();
  const toast = buildToast();
  document.body.append(guide, rewards, toast);
  const main = document.querySelector("main");
  if (main) main.before(dock);
  else document.body.prepend(dock);
  window.addEventListener("storage", syncFromStorage);

  function applyAccent(element) {
    element.style.setProperty("--realm-accent", accent);
    element.style.setProperty("--realm-accent-rgb", accentRgb);
  }

  function ensureStylesheet() {
    const href = new URL("./realm-ui.css?v=2", import.meta.url).href;
    if ([...document.styleSheets].some((sheet) => sheet.href === href)) return;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }

  function storageRead(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageWrite(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function loadProgress() {
    return progressFromStorage(storageRead(STORAGE_KEY));
  }

  function progressFromStorage(value) {
    try {
      return normalizeProgress(JSON.parse(value ?? "null"));
    } catch {
      return createProgress();
    }
  }

  function saveProgress(candidate = progress) {
    progress = mergeProgress(loadProgress(), candidate);
    storageWrite(STORAGE_KEY, JSON.stringify(progress));
    return progress;
  }

  function syncFromStorage(event) {
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    if (event.key === tutorialKey() && event.newValue === "seen") {
      cancelTutorialWait();
      return;
    }
    if (event.key === null) {
      progress = createProgress();
      updateDock();
      updateRewards();
      return;
    }
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === null) {
      progress = createProgress();
    } else {
      const incoming = progressFromStorage(event.newValue);
      progress = mergeProgress(progress, incoming);
      const mergedValue = JSON.stringify(progress);
      if (mergedValue !== JSON.stringify(incoming)) storageWrite(STORAGE_KEY, mergedValue);
    }
    updateDock();
    updateRewards();
  }

  function tutorialKey() {
    return `ten-realms:tutorial:${realmId}:v${TUTORIAL_VERSION}`;
  }

  function tutorialSeen() {
    return storageRead(tutorialKey()) === "seen";
  }

  function markTutorialSeen() {
    storageWrite(tutorialKey(), "seen");
  }

  function buildDock() {
    const element = document.createElement("aside");
    element.className = "realm-utility-dock";
    element.setAttribute("aria-label", "十境探索进度与教程");
    applyAccent(element);
    element.innerHTML = `
      <div class="realm-utility-dock__identity">
        <p class="realm-utility-dock__eyebrow">TEN REALMS · LOCAL PROGRESS</p>
        <button class="realm-utility-dock__rank" type="button" data-realm-rank aria-haspopup="dialog">见习旅者</button>
        <p class="realm-utility-dock__detail"><span data-realm-token>${tutorial.token}</span> · 本机记录</p>
      </div>
      <div class="realm-utility-dock__xp">
        <div class="realm-utility-dock__xp-row"><span>境界值</span><b><span data-realm-xp>0</span> XP</b></div>
        <div class="realm-utility-dock__track" role="progressbar" aria-label="距离下一境界的进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      </div>
      <div class="realm-utility-dock__stats" aria-label="本境统计">
        <span class="realm-utility-dock__stat"><b data-realm-clears>0</b><span>已破关</span></span>
        <span class="realm-utility-dock__stat"><b data-realm-streak>0</b><span>连游日</span></span>
      </div>
      <button class="realm-utility-dock__tutorial" type="button">图片教程</button>`;
    element.querySelector(".realm-utility-dock__rank").addEventListener("click", openRewards);
    element.querySelector(".realm-utility-dock__tutorial").addEventListener("click", () => openTutorial(false));
    updateDock(element);
    return element;
  }

  function updateDock(element = dock) {
    if (!element) return;
    const summary = progressSummary(progress, realmId);
    element.querySelector("[data-realm-rank]").textContent = summary.rank;
    element.querySelector("[data-realm-xp]").textContent = String(summary.xp);
    element.querySelector("[data-realm-clears]").textContent = String(summary.clears);
    element.querySelector("[data-realm-streak]").textContent = String(summary.streak);
    const track = element.querySelector(".realm-utility-dock__track");
    track.style.setProperty("--realm-progress", summary.ratio.toFixed(4));
    track.setAttribute("aria-valuenow", String(Math.round(summary.ratio * 100)));
    track.setAttribute("aria-valuetext", `${summary.rank}，${summary.xp} 境界值；下一境界：${summary.nextRank}`);
    const badgeText = summary.badges.length ? ` · ${summary.badges.at(-1)}` : "";
    element.querySelector(".realm-utility-dock__detail").title = `${summary.clears} 个关卡已完成${badgeText}`;
  }

  function buildRewards() {
    const dialog = document.createElement("dialog");
    dialog.className = "realm-progress-dialog";
    dialog.setAttribute("aria-labelledby", "realm-progress-title");
    applyAccent(dialog);
    dialog.innerHTML = `
      <div class="realm-progress-dialog__shell">
        <header class="realm-progress-dialog__topline">
          <div><p>TEN REALMS · REWARD MAP</p><h2 id="realm-progress-title">境界成长图鉴</h2></div>
          <button class="realm-progress-dialog__close" type="button" aria-label="关闭境界成长图鉴">×</button>
        </header>
        <div class="realm-progress-dialog__body">
          <section class="realm-progress-dialog__summary" aria-label="当前境界进度">
            <p>当前称号</p><strong data-progress-rank>见习旅者</strong>
            <span><b data-progress-xp>0</b> XP · 下一称号 <b data-progress-next>境门行者</b></span>
            <div class="realm-progress-dialog__track" aria-hidden="true"><i></i></div>
            <p class="realm-progress-dialog__quest" data-progress-quest></p>
          </section>
          <section class="realm-progress-dialog__section">
            <div class="realm-progress-dialog__heading"><h3>本境徽章</h3><span data-progress-clears>0 个关卡</span></div>
            <ul class="realm-progress-dialog__badges" data-progress-badges></ul>
          </section>
          <section class="realm-progress-dialog__section">
            <div class="realm-progress-dialog__heading"><h3>如何获得境界值</h3><span>十款游戏共享</span></div>
            <ul class="realm-progress-dialog__earning">
              <li><b>120 / 180 / 260 XP</b><span>按难度首次通关</span></li>
              <li><b>约 43 / 65 / 94 XP</b><span>刷新个人最佳</span></li>
              <li><b>20–90 XP</b><span>达到或优于建议步数</span></li>
              <li><b>50–110 XP</b><span>今日首胜与连续游玩</span></li>
              <li><b>30 XP / 枚</b><span>解锁新的本境徽章</span></li>
            </ul>
          </section>
          <section class="realm-progress-dialog__section">
            <div class="realm-progress-dialog__heading"><h3>称号阶梯</h3><span>最高 5200 XP</span></div>
            <ol class="realm-progress-dialog__ranks" data-progress-ranks></ol>
          </section>
          <p class="realm-progress-dialog__privacy">进度只保存在这台设备的浏览器中；单纯重复同一成绩不会刷分，探索新关卡或刷新最佳才会继续成长。</p>
        </div>
      </div>`;
    dialog.querySelector(".realm-progress-dialog__close").addEventListener("click", closeRewards);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeRewards();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeRewards();
    });
    updateRewards(dialog);
    return dialog;
  }

  function nextQuest(summary) {
    const nextRule = badgeRules.find(({ name }) => !summary.badges.includes(name));
    if (!nextRule) return "本境徽章已集齐：继续刷新个人最佳，向最高称号进发。";
    if (nextRule.skillful) return "下一目标：达到效率线或刷新一次个人最佳，点亮「妙手破局」。";
    if (nextRule.clears === 1) return "下一目标：完成本境任意一关，点亮「初入此境」。";
    const remaining = Math.max(0, nextRule.clears - summary.clears);
    if (remaining === 0) return `下一目标：完成任意一局结算，点亮「${nextRule.name}」。`;
    return `下一目标：再完成 ${remaining} 个不同关卡，点亮「${nextRule.name}」。`;
  }

  function updateRewards(element = rewards) {
    if (!element) return;
    const summary = progressSummary(progress, realmId);
    element.querySelector("[data-progress-rank]").textContent = summary.rank;
    element.querySelector("[data-progress-xp]").textContent = String(summary.xp);
    element.querySelector("[data-progress-next]").textContent = summary.nextRank;
    element.querySelector("[data-progress-clears]").textContent = `${summary.clears} 个关卡`;
    element.querySelector("[data-progress-quest]").textContent = nextQuest(summary);
    element.querySelector(".realm-progress-dialog__track i").style.setProperty("--realm-progress", summary.ratio.toFixed(4));
    const unlocked = new Set(summary.badges);
    element.querySelector("[data-progress-badges]").innerHTML = badgeRules.map(({ name, description }) => `
      <li class="${unlocked.has(name) ? "is-unlocked" : "is-locked"}">
        <i aria-hidden="true">${unlocked.has(name) ? "◆" : "◇"}</i><span><b>${name}</b><small>${description}</small></span>
      </li>`).join("");
    element.querySelector("[data-progress-ranks]").innerHTML = RANKS.map((rank) => `
      <li class="${summary.xp >= rank.threshold ? "is-reached" : ""}${summary.rank === rank.name ? " is-current" : ""}">
        <span>${rank.name}</span><b>${rank.threshold} XP</b>
      </li>`).join("");
  }

  function isUsableFocusTarget(element) {
    if (!(element instanceof Element) || typeof element.focus !== "function" || !element.isConnected) return false;
    if (element === document.body || element === document.documentElement) return false;
    if (element.closest(".realm-guide-dialog, .realm-progress-dialog, .realm-reward-toast")) return false;
    if (element.matches("[disabled]") || element.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    const parentDialog = element.closest("dialog");
    if (parentDialog && !parentDialog.open) return false;
    const interactive = element.matches("button, a[href], input, select, textarea, summary, canvas[tabindex], [tabindex]:not([tabindex='-1'])");
    if (!interactive) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function rememberFocus() {
    return isUsableFocusTarget(document.activeElement) ? document.activeElement : null;
  }

  function preferredGameFocus() {
    const selectors = [
      "[data-realm-game-focus]",
      "main [autofocus]",
      "main [role='grid'] [tabindex='0']",
      "main [role='grid'] button:not([disabled])",
      "main .board button:not([disabled])",
      "main [id*='board'] button:not([disabled])",
      "main [class*='board'] button:not([disabled])",
      "main canvas[tabindex]",
      "main [tabindex='0']",
      "main button:not([disabled])",
    ];
    for (const selector of selectors) {
      const target = [...document.querySelectorAll(selector)].find(isUsableFocusTarget);
      if (target) return target;
    }
    return null;
  }

  function restoreFocus(fallback) {
    const target = isUsableFocusTarget(lastFocus)
      ? lastFocus
      : preferredGameFocus() ?? fallback;
    lastFocus = null;
    if (isUsableFocusTarget(target)) target.focus({ preventScroll: true });
  }

  function openRewards() {
    if (rewards.open || [...document.querySelectorAll("dialog[open]")].some((dialog) => dialog !== rewards)) return;
    lastFocus = rememberFocus();
    updateRewards();
    if (typeof rewards.showModal === "function") rewards.showModal();
    else rewards.setAttribute("open", "");
    rewards.querySelector(".realm-progress-dialog__close").focus({ preventScroll: true });
  }

  function closeRewards() {
    if (rewards.open && typeof rewards.close === "function") rewards.close();
    else rewards.removeAttribute("open");
    const fallback = dock.querySelector(".realm-utility-dock__rank");
    restoreFocus(fallback);
  }

  function buildGuide() {
    const dialog = document.createElement("dialog");
    dialog.className = "realm-guide-dialog";
    dialog.setAttribute("aria-labelledby", "realm-guide-title");
    dialog.setAttribute("aria-describedby", "realm-guide-body");
    applyAccent(dialog);
    dialog.innerHTML = `
      <div class="realm-guide-dialog__shell">
        <header class="realm-guide-dialog__topline">
          <p>${tutorial.title} · 入境图鉴</p>
          <button class="realm-guide-dialog__skip" type="button">跳过，直接开始</button>
        </header>
        <article class="realm-guide-card">
          <div class="realm-guide-card__visual" data-guide-visual></div>
          <div class="realm-guide-card__copy">
            <p class="realm-guide-card__step" data-guide-step></p>
            <h2 id="realm-guide-title" data-guide-title></h2>
            <p class="realm-guide-card__body" id="realm-guide-body" data-guide-body></p>
            <ul class="realm-guide-card__bullets" data-guide-bullets></ul>
          </div>
        </article>
        <footer class="realm-guide-dialog__footer">
          <p class="realm-guide-dialog__counter" data-guide-counter></p>
          <div class="realm-guide-dialog__dots" aria-hidden="true" data-guide-dots></div>
          <button class="realm-guide-dialog__next" type="button" data-guide-next>下一张</button>
        </footer>
      </div>`;

    dialog.querySelector(".realm-guide-dialog__skip").addEventListener("click", () => closeTutorial("skip"));
    dialog.querySelector("[data-guide-next]").addEventListener("click", nextTutorialCard);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeTutorial("skip");
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeTutorial("skip");
    });

    let pointerStart = null;
    dialog.querySelector(".realm-guide-card").addEventListener("pointerdown", (event) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    });
    dialog.querySelector(".realm-guide-card").addEventListener("pointerup", (event) => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (dx < 0) nextTutorialCard();
      else if (currentCard > 0) {
        currentCard -= 1;
        renderTutorialCard();
      }
    });
    return dialog;
  }

  function renderTutorialCard() {
    const card = tutorial.cards[currentCard];
    guide.querySelector("[data-guide-visual]").innerHTML = tutorialArt(realmId, card.focus);
    guide.querySelector("[data-guide-step]").textContent = `${String(currentCard + 1).padStart(2, "0")} · ${card.tag}`;
    guide.querySelector("[data-guide-title]").textContent = card.title;
    guide.querySelector("[data-guide-body]").textContent = card.body;
    guide.querySelector("[data-guide-bullets]").innerHTML = card.bullets.map((item) => `<li>${item}</li>`).join("");
    guide.querySelector("[data-guide-counter]").textContent = `${currentCard + 1} / ${tutorial.cards.length}`;
    guide.querySelector("[data-guide-dots]").innerHTML = tutorial.cards.map((_, index) => `<i class="${index === currentCard ? "is-active" : ""}"></i>`).join("");
    guide.querySelector("[data-guide-next]").textContent = currentCard === tutorial.cards.length - 1 ? "开始游戏" : "下一张";
    guide.querySelector(".realm-guide-card").scrollTop = 0;
  }

  function blockingDialog() {
    return [...document.querySelectorAll("dialog[open]")].find((dialog) => dialog !== guide) ?? null;
  }

  function cancelTutorialWait() {
    tutorialWaitObserver?.disconnect();
    tutorialWaitObserver = null;
  }

  function waitForBlockingDialog() {
    if (tutorialWaitObserver || tutorialSeen()) return;
    tutorialWaitObserver = new MutationObserver(() => {
      if (tutorialSeen()) {
        cancelTutorialWait();
        return;
      }
      if (blockingDialog()) return;
      cancelTutorialWait();
      window.setTimeout(() => openTutorial(true), 0);
    });
    tutorialWaitObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true,
    });
    if (!blockingDialog()) {
      cancelTutorialWait();
      window.setTimeout(() => openTutorial(true), 0);
    }
  }

  function openTutorial(auto) {
    if (auto && tutorialSeen()) {
      cancelTutorialWait();
      return;
    }
    if (guide.open) return;
    if (blockingDialog()) {
      if (auto) waitForBlockingDialog();
      return;
    }
    cancelTutorialWait();
    currentCard = 0;
    lastFocus = rememberFocus();
    renderTutorialCard();
    if (typeof guide.showModal === "function") guide.showModal();
    else guide.setAttribute("open", "");
    guide.querySelector("[data-guide-next]").focus({ preventScroll: true });
  }

  function nextTutorialCard() {
    if (currentCard < tutorial.cards.length - 1) {
      currentCard += 1;
      renderTutorialCard();
      return;
    }
    closeTutorial("complete");
  }

  function closeTutorial(reason) {
    markTutorialSeen();
    cancelTutorialWait();
    if (guide.open && typeof guide.close === "function") guide.close(reason);
    else guide.removeAttribute("open");
    const fallback = dock.querySelector(".realm-utility-dock__tutorial");
    restoreFocus(fallback);
  }

  function buildToast() {
    const element = document.createElement("section");
    element.className = "realm-reward-toast";
    element.setAttribute("popover", "manual");
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    applyAccent(element);
    return element;
  }

  function showReward(result) {
    window.clearTimeout(toastTimer);
    window.clearTimeout(toastRevealTimer);
    window.clearTimeout(toastHideTimer);
    toast.classList.remove("is-visible");
    if (typeof toast.hidePopover === "function" && toast.matches(":popover-open")) toast.hidePopover();
    toast.innerHTML = `
      <div class="realm-reward-toast__top"><strong>${result.firstClear ? "首次破关" : result.personalBest ? "新个人最佳" : "探索完成"}</strong><b>+${result.awarded} XP</b></div>
      <ul>${result.breakdown.map((item) => `<li><span>${item.label}</span><b>+${item.points}</b></li>`).join("")}</ul>`;
    toastRevealTimer = window.setTimeout(() => {
      if (typeof toast.showPopover === "function") toast.showPopover();
      window.requestAnimationFrame(() => toast.classList.add("is-visible"));
      toastTimer = window.setTimeout(() => {
        toast.classList.remove("is-visible");
        toastHideTimer = window.setTimeout(() => {
          if (typeof toast.hidePopover === "function" && toast.matches(":popover-open")) toast.hidePopover();
        }, 300);
      }, 4800);
    }, 1050);
  }

  function complete(payload = {}) {
    progress = mergeProgress(progress, loadProgress());
    const result = awardCompletion(progress, { ...payload, realm: realmId });
    if (result.awarded <= 0) {
      updateDock();
      updateRewards();
      return { ...result, progress };
    }
    progress = result.progress;
    saveProgress();
    updateDock();
    updateRewards();
    showReward(result);
    const syncedResult = { ...result, progress };
    window.dispatchEvent(new CustomEvent("realm:progress", { detail: { realm: realmId, ...syncedResult } }));
    return syncedResult;
  }

  function snapshot() {
    progress = mergeProgress(progress, loadProgress());
    updateDock();
    updateRewards();
    return progressSummary(progress, realmId);
  }

  window.RealmArcade = Object.freeze({
    realm: realmId,
    complete,
    getSnapshot: snapshot,
    openTutorial: () => openTutorial(false),
  });

  const queued = Array.isArray(window.__realmCompletionQueue) ? window.__realmCompletionQueue.splice(0) : [];
  for (const payload of queued) complete(payload);
  window.dispatchEvent(new CustomEvent("realm:ready", { detail: { realm: realmId } }));

  if (!tutorialSeen()) {
    window.setTimeout(() => openTutorial(true), 420);
  }
}
