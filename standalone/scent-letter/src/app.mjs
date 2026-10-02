import levels from "./levels.json";
import { newRun, submit, edit, undo, secretFor, suggestion, restore, dailyLevel } from "./engine.mjs";
import { KEY, TUTORIAL_KEY, load, save, settle, deliver } from "./storage.mjs";
import { ingredients, peg, row, seals } from "./view.mjs";
const app = document.getElementById("app"), modalRoot = document.getElementById("modal-root");
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = { getItem: () => null, setItem: () => {
    throw Error("disabled");
  } };
}
function findLevel(id2) {
  if (id2 && id2.indexOf("daily:") === 0) {
    const match = /^daily:(\d{4})-(\d{2})-(\d{2}):v1$/.exec(id2);
    if (!match) return null;
    const d = new Date(+match[1], +match[2] - 1, +match[3]);
    return dailyLevel(levels, d).id === id2 ? dailyLevel(levels, d) : null;
  }
  return levels.find((l) => l.id === id2);
}
let db = load(storage, findLevel), screen = "home", chapter = 1, selected = 0, message = "", modal = null, focusBefore = null, saveOK = true;
const chapterCopy = ["从两枚印章开始，读懂香气留下的线索。", "同一味香可以出现多次，每一滴只计一次。", "成分相同，位置不同，印章也会改变。", "六种香材登场，先排除，再寻找。", "把候选分组，让每次试香带来新信息。", "五滴成笺，为最后一味留下推理的余地。"];
const level = () => db.current && findLevel(db.current.levelId);
const id = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
function persist() {
  saveOK = save(storage, db);
  if (saveOK) db = deliver(storage, db, window.scentLetterHost);
  return saveOK;
}
function header(back = false) {
  return `<header><button class="brand" data-act="home" aria-label="返回香笺首页"><span class="brand-seal">笺</span><span>香笺秘方<small>THE SCENT ARCHIVE</small></span></button><button class="quiet" data-act="${back ? "home" : "tutorial"}">${back ? "返回信匣" : "玩法图解"}</button></header>`;
}
function home() {
  const completed = new Set(db.records.filter((r) => !r.practice && r.levelId.indexOf("daily:") !== 0).map((r) => r.levelId));
  return `${header()}<main class="home"><section class="hero"><div class="hero-copy"><p class="eyebrow">一封来信 · 一味秘密</p><h1>香气无形，<br>线索有迹。</h1><p>在玻璃滴管与旧信纸之间，<br>用两枚印章，读懂未曾署名的秘方。</p><div class="hero-actions"><button class="primary" data-act="${db.current ? "resume" : "start"}" data-id="${levels[0].id}">${db.current ? "继续这封来信" : "拆开第一封信"} <span>↗</span></button><button class="quiet" data-act="daily">今日秘方</button></div><p class="small">60封委托 · 6册香笺 · 离线可玩</p></div><div class="still-life" aria-hidden="true"><div class="paper-letter"><span>CHAMBRE<br>DES PARFUMS</span><i></i><i></i><i></i><b>笺</b></div><div class="plant">❧</div><div class="bottle bottle-a"><span>ROSE<br>01</span></div><div class="bottle bottle-b"><span>CEDAR<br>03</span></div><div class="bottle bottle-c"><span>IRIS<br>04</span></div></div></section><section class="archive"><div class="section-title"><div><p class="eyebrow">YOUR CORRESPONDENCE</p><h2>六册来信</h2></div><button class="quiet" data-act="collection">收藏 ${completed.size}/60</button></div><div class="chapters">${Array.from({ length: 6 }, (_, i) => `<button class="chapter-card ${chapter === i + 1 ? "active" : ""}" data-act="chapter" data-chapter="${i + 1}"><span class="roman">${["I", "II", "III", "IV", "V", "VI"][i]}</span><span><strong>${levels[i * 10].chapterName}</strong><small>${completedCount(i + 1)}/10 封已解</small></span><span class="arrow">↗</span></button>`).join("")}</div><div class="chapter-intro"><h3>${levels[(chapter - 1) * 10].chapterName}</h3><p>${chapterCopy[chapter - 1]}</p></div><div class="level-grid">${levels.filter((l) => l.chapter === chapter).map((l) => `<button class="letter-card" data-act="start" data-id="${l.id}"><span class="letter-num">${String(l.index).padStart(2, "0")}</span><strong>${l.title}</strong><small>${completed.has(l.id) ? "已收藏 · 可练习" : l.initialCandidates + " 种初始可能"}</small><span class="letter-stamp">${completed.has(l.id) ? "✓" : "✉"}</span></button>`).join("")}</div></section><footer>规则源自 Guess / Mastermind · 独立主题与交互 · AI 辅助开发<button class="quiet" data-act="about">规则与来源</button></footer></main>`;
}
function completedCount(c) {
  return new Set(db.records.filter((r) => !r.practice && findLevel(r.levelId)?.chapter === c && r.levelId.indexOf("daily:") !== 0).map((r) => r.levelId)).size;
}
function game() {
  const l = level(), r = db.current;
  if (!l) return home();
  return `${header(true)}<main class="desk"><aside class="letter-brief"><p class="eyebrow">${l.mode === "daily" ? "DAILY LETTER" : "VOL. " + String(l.chapter).padStart(2, "0") + " / LETTER " + String(l.index).padStart(2, "0")}</p><h1>${l.title}</h1><p>${chapterCopy[l.chapter - 1]}</p><div class="brief-rule"><strong>${l.params.colours} 香 · ${l.params.slots} 槽 · ${l.params.guesses} 轮</strong><p>香材可重复，空槽不可提交。<br>已有记录不消耗你的轮次。</p></div><div class="legend"><p><b class="exact">实印</b> 香材与位置都对</p><p><b class="misplaced">空印</b> 香材对，位置不对</p><small>印章只表示总数，不对应具体槽位。</small></div><button class="quiet" data-act="tutorial">重看三图教程 ↗</button><div class="practice-note">${r.status === "lost" ? "答案已揭晓 · 重玩将记为练习" : r.status === "won" ? "本封已完成 · 可返回信匣" : r.practice ? "这封信已试过 · 练习模式" : r.hints ? "已使用提示 · 辅助解出单独记录" : "未看答案 · 独立解出可入藏"}</div></aside><section class="workbench"><div class="bench-heading"><span>试香手记</span><span>${r.history.length} / ${l.params.guesses} 轮</span></div><div class="history" aria-label="试香历史">${l.clues.map((c, i) => `<div class="history-row clue"><span class="row-label">来信 ${i + 1}</span>${row(c.pegs)}${seals(c.feedback)}</div>`).join("")}${r.history.map((c, i) => `<div class="history-row"><span class="row-label">试香 ${i + 1}</span>${row(c.pegs)}${seals(c.feedback)}</div>`).join("")}${!r.history.length ? '<p class="history-empty">读一读来信的印章，再配出你的第一轮。</p>' : ""}</div><div class="input-zone">${r.status === "playing" ? `<div class="input-caption"><strong>这一轮的配方</strong><span>当前第 ${selected + 1} 槽</span></div><div class="slots">${r.draft.map((v, i) => `<button class="slot ${selected === i ? "selected" : ""}" data-act="slot" data-index="${i}" aria-label="第${i + 1}槽：${v ? ingredients[v - 1].name : "空"}" aria-pressed="${selected === i}">${peg(v)}<small>${i + 1}</small></button>`).join("")}</div><div class="palette">${ingredients.slice(0, l.params.colours).map((p, i) => `<button class="ingredient" data-act="ingredient" data-value="${i + 1}" aria-label="放入${p.name}">${peg(i + 1)}</button>`).join("")}</div><div class="tools"><button class="quiet" data-act="undo" ${!r.undo.length ? "disabled" : ""}>撤销填写</button><button class="quiet" data-act="clear">清空一槽</button><button class="quiet" data-act="hint">推理提示</button><button class="quiet" data-act="restart">重新试香</button></div><button class="primary submit" data-act="submit">递交配方 <span>盖印 →</span></button><div class="notes"><span>候选笔记（仅作标记）</span>${ingredients.slice(0, l.params.colours).map((p, i) => `<button class="note ${r.notes.includes(i + 1) ? "crossed" : ""}" data-act="note" data-value="${i + 1}" aria-pressed="${r.notes.includes(i + 1)}">${p.name}</button>`).join("")}</div>` : `<div class="result"><span class="result-seal">${r.status === "won" ? "成" : "阅"}</span><h2>${r.status === "won" ? "香笺已成，秘方有名。" : "这封信，留待再读。"}</h2><p>${r.status === "won" ? `${r.history.length}轮 · ${r.practice ? "练习完成" : r.hints ? "辅助解出" : "独立解出"}` : "轮次已用尽，下面是本封秘方。"}</p>${row(secretFor(l))}<p class="small">参考策略 ${l.referenceRounds} 轮 · 非最优步数</p><div class="result-actions"><button class="primary" data-act="next">${l.mode === "daily" ? "返回信匣" : "下一封来信"}</button><button class="quiet" data-act="restart">再练一次</button></div></div>`}<p class="message" role="status">${message || "完整配方才耗一轮；提交后不可撤回反馈。"}</p></div></section></main>`;
}
function render() {
  app.innerHTML = screen === "game" ? game() : home();
  if (!saveOK) {
    const p = document.createElement("p");
    p.className = "storage-warning";
    p.textContent = "浏览器未能保存进度，本次可继续游玩；关闭页面后可能丢失。";
    app.prepend(p);
  }
}
function start(l) {
  if (db.current && db.current.levelId === l.id) {
    screen = "game";
    selected = 0;
    message = "";
    render();
    firstTutorial();
    return;
  }
  db.current = newRun(l, id(), db.revealed.includes(l.id) || db.revealed.some((k) => {
    const prior = findLevel(k);
    return prior && (prior.sourceId || prior.id) === (l.sourceId || l.id);
  }));
  screen = "game";
  selected = 0;
  message = "";
  persist();
  render();
  firstTutorial();
}
function firstTutorial() {
  try {
    if (storage.getItem(TUTORIAL_KEY) !== "seen") openTutorial();
  } catch {
    openTutorial();
  }
}
function openModal(content, type = "generic") {
  if (!modal) focusBefore = document.activeElement;
  modal = { type };
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${type === "tutorial" ? "玩法图解" : "香笺说明"}" tabindex="-1">${content}</section></div>`;
  document.body.classList.add("modal-open");
  modalRoot.querySelector(".modal").focus();
}
function closeModal() {
  modalRoot.innerHTML = "";
  modal = null;
  document.body.classList.remove("modal-open");
  if (focusBefore && document.contains(focusBefore)) focusBefore.focus();
  else app.querySelector("button")?.focus();
}
let card = 0;
const tutorials = [["01 · 认识调香桌", "一封秘方，四个槽位", "先点一个槽位，再点香材。同一种香材可以放多滴。空槽不能递交。", "tutorial-1.svg"], ["02 · 读懂两枚印章", "每一滴，只统计一次", "这次配方是玫瑰、佛手、玫瑰、鸢尾。实印1：位置和香材都对；空印2：香材对但位置不对。印章不对应槽位。", "tutorial-2.svg"], ["03 · 同一封信的完成态", "让四滴香，都回到原位", "同局秘方：玫瑰、玫瑰、佛手、雪松。实印4，空印0，完成。正式游戏的秘方各不相同。", "tutorial-3.svg"]];
function openTutorial() {
  card = 0;
  showTutorial();
}
function showTutorial() {
  const t = tutorials[card], oldFocus = focusBefore;
  openModal(`<p class="eyebrow">${t[0]}</p><h2>${t[1]}</h2><img class="tutorial-image" src="assets/${t[3]}" alt="${t[2]}"><p>${t[2]}</p><div class="modal-actions"><button class="quiet" data-act="skip">${card === 2 ? "关闭" : "跳过教程"}</button><button class="primary" data-act="tutorial-next">${card === 2 ? "开始试香" : "下一张 →"}</button></div>`, "tutorial");
  if (card > 0) focusBefore = oldFocus;
}
function seenTutorial() {
  try {
    storage.setItem(TUTORIAL_KEY, "seen");
  } catch {
  }
  closeModal();
}
function collection() {
  openModal(`<p class="eyebrow">COLLECTED LETTERS / VOL. ${chapter}</p><h2>${levels[(chapter - 1) * 10].chapterName}</h2><div class="collection-list">${levels.filter((l) => l.chapter === chapter).map((l) => {
    const records = db.records.filter((r) => r.levelId === l.id && !r.practice);
    const best = records.sort((a, b) => a.hints - b.hints || a.history.length - b.history.length)[0];
    return `<p><strong>${l.title}</strong><span>${best ? best.history.length + "轮 · " + (best.hints ? "辅助解出" : "独立解出") : "尚未入藏"}</span></p>`;
  }).join("")}</div><div class="modal-actions"><button class="quiet" data-act="collection-prev">上一册</button><button class="quiet" data-act="collection-next">下一册</button><button class="primary" data-act="close">合上图鉴</button></div>`);
}
function handle(e) {
  const b = e.target.closest("button[data-act]");
  if (!b || b.disabled) return;
  const a = b.dataset.act, r = db.current, l = level();
  if (a === "home") {
    screen = "home";
    message = "";
    render();
  } else if (a === "chapter") {
    chapter = +b.dataset.chapter;
    render();
  } else if (a === "start") start(findLevel(b.dataset.id));
  else if (a === "resume") {
    screen = "game";
    render();
    firstTutorial();
  } else if (a === "daily") start(dailyLevel(levels));
  else if (a === "tutorial") openTutorial();
  else if (a === "skip") seenTutorial();
  else if (a === "tutorial-next") {
    if (card === 2) seenTutorial();
    else {
      card++;
      showTutorial();
    }
  } else if (a === "close") closeModal();
  else if (a === "collection") collection();
  else if (a === "collection-prev" || a === "collection-next") {
    chapter = (chapter + (a === "collection-next" ? 0 : 4)) % 6 + 1;
    collection();
  } else if (a === "about") openModal('<h2>两枚印章，一道秘方</h2><p>完整填写后才消耗一轮。实印统计位置与香材都相同的滴数；扣除实印后，空印按剩余香材的数量逐一配对。</p><p>全部位置命中即胜利；轮次耗尽则揭晓答案。提交后不可撤销已获得的信息，“撤销填写”仅撤销未提交的编辑。提示按已有反馈筛选候选，不读取秘密答案。</p><p>首解与辅助解出分别记录。揭晓后的重玩标记练习。每日来信从已验证的题库按本地日期选取，可能遇到曾玩过的题面。</p><p>规则参考 Simon Tatham Portable Puzzle Collection 的 Guess / Mastermind。来源实现固定于55cdddb，沿用MIT许可。本作使用AI辅助开发，主题插画为代码绘制。</p><button class="primary" data-act="close">我知道了</button>');
  else if (a === "slot") {
    selected = +b.dataset.index;
    render();
    app.querySelectorAll(".slot")[selected].focus();
  } else if (a === "ingredient" || a === "clear") {
    db.current = edit(l, r, selected, a === "clear" ? 0 : +b.dataset.value);
    if (a === "ingredient") selected = (selected + 1) % l.params.slots;
    persist();
    render();
    app.querySelectorAll(".slot")[selected]?.focus();
  } else if (a === "undo") {
    db.current = undo(r);
    persist();
    render();
  } else if (a === "note") {
    const v = +b.dataset.value;
    db.current = { ...r, notes: r.notes.includes(v) ? r.notes.filter((x) => x !== v) : r.notes.concat(v) };
    persist();
    render();
  } else if (a === "submit") {
    const next = submit(l, r);
    if (next === r) {
      message = "请先填满所有槽位，再递交配方。";
      render();
      return;
    }
    db = settle(db, next);
    if (!db.revealed.includes(l.id)) db.revealed.push(l.id);
    persist();
    selected = 0;
    message = "";
    render();
    const h = app.querySelector(".history");
    h.scrollTop = h.scrollHeight;
  } else if (a === "restart") {
    openModal('<h2>重新试香？</h2><p>当前填写与试香记录会重置。你已经见过的反馈不会变成新的独立解题机会，本封重开记为练习。</p><div class="modal-actions"><button class="quiet" data-act="close">继续当前配方</button><button class="primary" data-act="restart-confirm">重开练习</button></div>');
  } else if (a === "restart-confirm") {
    closeModal();
    db.current = newRun(l, id(), true);
    if (!db.revealed.includes(l.id)) db.revealed.push(l.id);
    selected = 0;
    message = "";
    persist();
    render();
  } else if (a === "next") {
    if (l.mode === "daily") {
      screen = "home";
      render();
    } else start(levels[(levels.findIndex((x) => x.id === l.id) + 1) % levels.length]);
  } else if (a === "hint") {
    const s = suggestion(l, r);
    openModal(`<p class="eyebrow">推理提示 · 不消耗轮次</p><h2>还有 ${s.count} 种可能</h2><p>把每一种配方代入全部已有记录，只保留能复现每一枚印章的候选。下面是一份符合所有反馈的候选，${s.count === 1 ? "目前只有这一份符合。" : "仍需要试香验证。"}</p>${row(s.pegs)}<p>查看本提示计为辅助解题；填入后仍需你亲自递交。</p><div class="modal-actions"><button class="quiet" data-act="close">自己继续推理</button><button class="primary" data-act="hint-fill">填入这个候选</button></div>`);
    db.current = { ...r, hints: r.hints + 1 };
    persist();
  } else if (a === "hint-fill") {
    const s = suggestion(l, db.current);
    closeModal();
    db.current = { ...db.current, draft: s.pegs.slice(), undo: db.current.undo.concat([db.current.draft]) };
    persist();
    render();
  }
}
app.addEventListener("click", handle);
modalRoot.addEventListener("click", handle);
document.addEventListener("keydown", (e) => {
  if (!modal) return;
  if (e.key === "Escape") {
    if (modal.type === "tutorial") seenTutorial();
    else closeModal();
  }
  if (e.key === "Tab") {
    const buttons = Array.from(modalRoot.querySelectorAll("button:not(:disabled)"));
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === modalRoot.querySelector(".modal"))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === modalRoot.querySelector(".modal"))) {
      e.preventDefault();
      first.focus();
    }
  }
});
persist();
render();
