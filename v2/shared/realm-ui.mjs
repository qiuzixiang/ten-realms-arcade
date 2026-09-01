import { awardCompletion, badgeRulesForRealm, mergeProgress, normalizeProgress, progressSummary, RANKS } from "./reward-engine.mjs";
import { REALM_CONFIGS, REALM_TUTORIALS, tutorialArt } from "./tutorial-data.mjs";
import { V2_PROGRESS_KEY, readStoredJson, tutorialStorageKey, writeStoredJson, writeStoredValue, readStoredValue } from "./storage.mjs";

const realmId = document.documentElement.dataset.realm
  || window.location.pathname.split("/").filter(Boolean).at(-1)
  || "";
const config = REALM_CONFIGS[realmId];
const tutorial = REALM_TUTORIALS[realmId];

// Games can be opened from a deep link without visiting the V2.5 guide first.
// Register from this shared bootstrap so those entries still receive v2 offline support.
if ("serviceWorker" in navigator) {
  const workerUrl = new URL("../sw.js", import.meta.url);
  const scopeUrl = new URL("../", import.meta.url);
  navigator.serviceWorker.register(workerUrl, { scope: scopeUrl.pathname }).catch(() => {
    // Offline support is progressive enhancement; gameplay remains available online.
  });
}

if (config) {
  const accent = config.accent || "#70f0d0";
  const accentRgb = config.accentRgb || "112, 240, 208";
  const seenKey = tutorial ? tutorialStorageKey(realmId, tutorial.version || 1) : "";
  let progress = normalizeProgress(readStoredJson(V2_PROGRESS_KEY, null));
  let cardIndex = 0;
  let waitObserver = null;

  ensureStyles();
  const dock = buildDock();
  const guide = tutorial ? buildGuide() : null;
  const rewards = buildRewards();
  const toast = buildToast();
  if (guide) document.body.append(guide);
  document.body.append(rewards, toast);
  const main = document.querySelector("main");
  if (main) main.before(dock);
  else document.body.prepend(dock);

  function applyAccent(node) {
    node.style.setProperty("--realm-accent", accent);
    node.style.setProperty("--realm-accent-rgb", accentRgb);
  }

  function ensureStyles() {
    const href = new URL("./realm-ui.css", import.meta.url).href;
    const alreadyLoaded = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .some((link) => link.href === href);
    if (alreadyLoaded) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }

  function buildDock() {
    const node = document.createElement("aside");
    node.className = "realm-utility-dock";
    node.setAttribute("aria-label", "2.5 探索进度与教程");
    applyAccent(node);
    node.innerHTML = `
      <div><small>SECOND EXPEDITION · LOCAL</small><button type="button" data-rank>新境访客</button></div>
      <div class="realm-utility-dock__progress"><span><b data-xp>0</b> XP</span><i><em data-bar></em></i></div>
      <span class="realm-utility-dock__stat"><b data-clears>0</b><small>已破关</small></span>
      <button type="button" data-tutorial>图片教程</button>`;
    node.querySelector("[data-rank]").addEventListener("click", openRewards);
    node.querySelector("[data-tutorial]").addEventListener("click", () => openTutorial(false));
    updateDock(node);
    return node;
  }

  function buildRewards() {
    const node = document.createElement("dialog");
    node.className = "realm-progress-dialog";
    node.setAttribute("aria-labelledby", "v2-progress-title");
    applyAccent(node);
    node.innerHTML = `
      <div class="realm-progress-dialog__shell">
        <header><div><small>SECOND EXPEDITION · REWARD MAP</small><h2 id="v2-progress-title">2.5 成长图鉴</h2></div><button type="button" data-progress-close aria-label="关闭成长图鉴">×</button></header>
        <section class="realm-progress-dialog__summary">
          <small>当前称号</small><strong data-progress-rank>新境访客</strong>
          <p><b data-progress-xp>0</b> XP · 下一称号 <b data-progress-next>探路新星</b></p>
          <i><em data-progress-bar></em></i><p data-progress-quest></p>
        </section>
        <section><div class="realm-progress-dialog__heading"><h3>本境徽章</h3><span data-progress-clears>0 个关卡</span></div><ul class="realm-progress-dialog__badges" data-progress-badges></ul></section>
        <section><div class="realm-progress-dialog__heading"><h3>如何获得 XP</h3><span>2.5 十五款共享</span></div>
          <ul class="realm-progress-dialog__earning">
            <li><b>120 / 180 / 260 XP</b><span>按难度首次通关</span></li>
            <li><b>约 43 / 65 / 94 XP</b><span>刷新个人最佳</span></li>
            <li><b>20–90 XP</b><span>达到或优于建议步数</span></li>
            <li><b>50–110 XP</b><span>今日首胜与连续游玩</span></li>
            <li><b>30 XP / 枚</b><span>解锁新的本境徽章</span></li>
          </ul>
        </section>
        <section><div class="realm-progress-dialog__heading"><h3>称号阶梯</h3><span>最高 5200 XP</span></div><ol class="realm-progress-dialog__ranks" data-progress-ranks></ol></section>
        <p class="realm-progress-dialog__privacy">所有进度只保存在这台设备的浏览器中。单纯重复同一成绩不会刷分；探索新关卡、提高效率与保持连游会持续获得奖励。</p>
      </div>`;
    node.querySelector("[data-progress-close]").addEventListener("click", closeRewards);
    node.addEventListener("cancel", (event) => { event.preventDefault(); closeRewards(); });
    return node;
  }

  function updateRewards() {
    const summary = progressSummary(progress, realmId);
    const rules = badgeRulesForRealm(realmId);
    rewards.querySelector("[data-progress-rank]").textContent = summary.rank;
    rewards.querySelector("[data-progress-xp]").textContent = String(summary.xp);
    rewards.querySelector("[data-progress-next]").textContent = summary.nextRank;
    rewards.querySelector("[data-progress-bar]").style.width = `${summary.ratio * 100}%`;
    rewards.querySelector("[data-progress-clears]").textContent = `${summary.clears} 个关卡`;
    const nextBadge = rules.find((rule) => !summary.badges.includes(rule.name));
    rewards.querySelector("[data-progress-quest]").textContent = nextBadge
      ? `下一目标：${nextBadge.name} · ${nextBadge.description}`
      : "本境徽章已全部收集，继续挑战个人最佳。";
    const badgeList = rewards.querySelector("[data-progress-badges]");
    badgeList.replaceChildren(...rules.map((rule) => {
      const item = document.createElement("li");
      const unlocked = summary.badges.includes(rule.name);
      item.className = unlocked ? "is-unlocked" : "";
      item.innerHTML = `<i aria-hidden="true">${unlocked ? "◆" : "◇"}</i><span><b></b><small></small></span>`;
      item.querySelector("b").textContent = rule.name;
      item.querySelector("small").textContent = rule.description;
      return item;
    }));
    const rankList = rewards.querySelector("[data-progress-ranks]");
    rankList.replaceChildren(...RANKS.map((rank) => {
      const item = document.createElement("li");
      if (summary.xp >= rank.threshold) item.className = "is-reached";
      item.innerHTML = "<span></span><b></b><small></small>";
      item.querySelector("span").textContent = summary.xp >= rank.threshold ? "✓" : "·";
      item.querySelector("b").textContent = rank.name;
      item.querySelector("small").textContent = `${rank.threshold} XP`;
      return item;
    }));
  }

  function openRewards() {
    updateRewards();
    if (typeof rewards.showModal === "function") rewards.showModal();
    else rewards.setAttribute("open", "");
    rewards.querySelector("[data-progress-close]").focus({ preventScroll: true });
  }

  function closeRewards() {
    if (rewards.open && typeof rewards.close === "function") rewards.close();
    else rewards.removeAttribute("open");
    dock.querySelector("[data-rank]").focus({ preventScroll: true });
  }

  function updateDock(node = dock) {
    const summary = progressSummary(progress, realmId);
    node.querySelector("[data-rank]").textContent = summary.rank;
    node.querySelector("[data-xp]").textContent = String(summary.xp);
    node.querySelector("[data-clears]").textContent = String(summary.clears);
    node.querySelector("[data-bar]").style.width = `${summary.ratio * 100}%`;
  }

  function buildGuide() {
    const node = document.createElement("dialog");
    node.className = "realm-guide-dialog";
    node.setAttribute("aria-labelledby", "v2-guide-title");
    applyAccent(node);
    node.innerHTML = `
      <div class="realm-guide-dialog__shell">
        <header><div><small>HOW TO PLAY · ${tutorial.title}</small><h2 id="v2-guide-title"></h2></div><button type="button" data-close aria-label="跳过教程">跳过</button></header>
        <div class="realm-guide-dialog__art" data-art></div>
        <p data-body></p><ul data-bullets></ul>
        <footer><span data-position></span><button type="button" data-next>下一张</button></footer>
      </div>`;
    node.querySelector("[data-close]").addEventListener("click", closeTutorial);
    node.querySelector("[data-next]").addEventListener("click", () => {
      if (cardIndex < tutorial.cards.length - 1) {
        cardIndex += 1;
        renderCard();
      } else closeTutorial();
    });
    node.addEventListener("cancel", (event) => { event.preventDefault(); closeTutorial(); });
    return node;
  }

  function renderCard() {
    const card = tutorial.cards[cardIndex];
    guide.querySelector("#v2-guide-title").textContent = card.title;
    guide.querySelector("[data-art]").innerHTML = tutorialArt(realmId, card.focus);
    guide.querySelector("[data-body]").textContent = card.body;
    const bullets = guide.querySelector("[data-bullets]");
    bullets.replaceChildren(...card.bullets.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
    guide.querySelector("[data-position]").textContent = `${cardIndex + 1} / ${tutorial.cards.length}`;
    guide.querySelector("[data-next]").textContent = cardIndex === tutorial.cards.length - 1 ? "开始游戏" : "下一张";
    guide.scrollTop = 0;
  }

  function blockingDialog() {
    return [...document.querySelectorAll("dialog[open]")].find((item) => !guide || item !== guide);
  }

  function openTutorial(auto) {
    if (!tutorial) {
      const nativeButton = document.querySelector(config.nativeTutorialSelector || "#tutorial-button");
      nativeButton?.click();
      return;
    }
    if (guide.open) return;
    if (blockingDialog()) {
      if (!auto || waitObserver) return;
      waitObserver = new MutationObserver(() => {
        if (blockingDialog()) return;
        waitObserver.disconnect();
        waitObserver = null;
        openTutorial(true);
      });
      waitObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
      return;
    }
    cardIndex = 0;
    renderCard();
    if (typeof guide.showModal === "function") guide.showModal();
    else guide.setAttribute("open", "");
    guide.querySelector("[data-next]").focus({ preventScroll: true });
  }

  function closeTutorial() {
    if (!tutorial || !guide) return;
    writeStoredValue(seenKey, "seen");
    if (guide.open && typeof guide.close === "function") guide.close();
    else guide.removeAttribute("open");
    dock.querySelector("[data-tutorial]").focus({ preventScroll: true });
  }

  function buildToast() {
    const node = document.createElement("section");
    node.className = "realm-reward-toast";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    applyAccent(node);
    return node;
  }

  function showReward(result) {
    toast.textContent = `${result.firstClear ? "首次破关" : "探索完成"} · +${result.awarded} XP`;
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 4000);
  }

  function complete(payload = {}) {
    progress = mergeProgress(progress, normalizeProgress(readStoredJson(V2_PROGRESS_KEY, null)));
    const result = awardCompletion(progress, { ...payload, realm: realmId });
    if (!result.accepted) throw new TypeError("V2.5 completion requires one stable, canonical event identity.");
    if (!writeStoredJson(V2_PROGRESS_KEY, result.progress)) {
      throw new Error("Unable to persist V2.5 shared progress.");
    }
    progress = result.progress;
    updateDock();
    updateRewards();
    if (result.awarded) showReward(result);
    const synced = { ...result, progress };
    window.dispatchEvent(new CustomEvent("realm:progress", { detail: { realm: realmId, ...synced } }));
    return synced;
  }

  function snapshot() {
    progress = mergeProgress(progress, normalizeProgress(readStoredJson(V2_PROGRESS_KEY, null)));
    updateDock();
    updateRewards();
    return progressSummary(progress, realmId);
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== V2_PROGRESS_KEY) return;
    progress = mergeProgress(progress, normalizeProgress(readStoredJson(V2_PROGRESS_KEY, null)));
    updateDock();
    updateRewards();
  });
  window.RealmArcade = Object.freeze({ realm: realmId, complete, getSnapshot: snapshot, openTutorial: () => openTutorial(false) });
  const queued = Array.isArray(window.__realmCompletionQueue) ? window.__realmCompletionQueue.splice(0) : [];
  for (const payload of queued) {
    try {
      complete(payload);
    } catch {
      (window.__realmCompletionQueue ??= []).push(payload);
    }
  }
  window.dispatchEvent(new CustomEvent("realm:ready", { detail: { realm: realmId } }));
  if (tutorial && readStoredValue(seenKey) !== "seen") window.setTimeout(() => openTutorial(true), 420);
}
