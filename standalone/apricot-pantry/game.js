(() => {
  "use strict";
  const L = globalThis.ApricotLogic;
  const data = globalThis.ApricotLevels;
  const root = document.getElementById("app");
  if (!L || !data || data.levels.length !== 48) { root.textContent = "游戏资料未能加载，请刷新页面。"; return; }

  const STORE = "mini-polish:apricot-pantry:v1:save";
  const STORAGE_MIN_CLIENT_VERSION = 9460;
  // Version 1 boards that changed in the 4×4 difficulty revision. They let old
  // completion proofs remain verifiable without treating an old score as a new PB.
  const legacyBoards4 = {
    33: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
    34: [1, 2, 3, 4, 0, 6, 7, 8, 5, 9, 11, 12, 13, 10, 14, 15],
    35: [1, 2, 3, 4, 9, 5, 7, 8, 0, 6, 11, 12, 13, 10, 14, 15],
    36: [1, 6, 2, 3, 5, 11, 15, 4, 9, 10, 0, 7, 13, 14, 12, 8],
    37: [2, 7, 6, 0, 1, 5, 4, 3, 9, 10, 11, 8, 13, 14, 15, 12],
    38: [1, 2, 3, 4, 5, 10, 6, 7, 9, 14, 12, 8, 13, 11, 0, 15],
    39: [1, 2, 3, 4, 11, 7, 8, 0, 6, 9, 10, 12, 5, 13, 14, 15],
    40: [1, 2, 8, 3, 5, 7, 0, 4, 9, 6, 10, 12, 13, 14, 11, 15],
    45: [2, 5, 1, 4, 0, 6, 3, 8, 9, 7, 10, 12, 14, 13, 11, 15],
    47: [9, 1, 5, 3, 14, 2, 6, 4, 10, 0, 7, 8, 13, 11, 15, 12],
  };
  const tutorialBoards = [
    [1, 2, 3, 4, 0, 6, 7, 5, 8],
    [1, 2, 3, 4, 5, 6, 7, 0, 8],
    L.solved(3),
  ];
  const tutorialActions = [7, 8];
  const longSlideStart = [1, 2, 3, 4, 5, 6, 0, 7, 8];
  const longSlide = L.move(longSlideStart, 3, 8);
  if (L.key(L.move(tutorialBoards[0], 3, tutorialActions[0]).board) !== L.key(tutorialBoards[1])
    || L.key(L.move(tutorialBoards[1], 3, tutorialActions[1]).board) !== L.key(tutorialBoards[2])
    || longSlide.line.length !== 3 || !L.complete(longSlide.board, 3)) {
    throw new Error("Tutorial boards differ from Fifteen rules");
  }
  const flavors = ["杏仁午后", "青梅轻响", "橘皮日光", "桃花餐巾", "枇杷小径", "桂花玻璃", "桑椹留白", "苹果转角", "柚子长架", "莓果周末", "蜜桃开窗", "杏橘开张"];
  const flavorNotes = [
    "先看空位，再找能动的托盘。", "一整段滑移只算一次。", "远端托盘也能被点选。", "空位最后会停在被点的格。",
    "临时挪开正确的罐子也可以。", "先让路，才能把想要的罐子送进去。", "最后一行通常要连着最后一列一起看。", "每一步都可以撤销，慢慢试。",
    "四乘四只是更宽的收纳台。", "分区整理能减轻记忆负担。", "提示给出一条合法路线。", "把所有编号排好，才真正开门。",
  ];
  const escape = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const levelById = (id) => data.levels[id - 1];
  const chapterOf = (id) => Math.floor((id - 1) / 8) + 1;
  const two = (n) => String(n).padStart(2, "0");
  const nowId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  let storageOk = true;
  let saved = freshSave();
  let page = "home";
  let expandedChapter = 1;
  let nativeStorage = null;
  let storageWritable = true;
  let pendingWrite = Promise.resolve();
  let modal = null;
  let modalPage = 0;
  let tutorialMode = "main";
  let modalReturn = null;
  let hintStage = 0;
  let hintText = "";
  let hintIndex = -1;
  let hintRouteKey = "";
  let hintRoute = null;
  let message = "";
  let soundContext = null;
  let cancelledPointerClick = false;
  let animating = false;
  let animationToken = 0;

  function freshSave() {
    return { schema: 1, certificates: {}, completed: {}, best: {}, run: null, tutorialSeen: false, sound: false,
      completionIds: [], rewardIds: [], legacyRun: null };
  }

  function boardForProof(level, generatorVersion, boardKey) {
    if (generatorVersion === level.generatorVersion && boardKey === L.key(level.board)) return level.board;
    if (level.width === 4 && generatorVersion === 1) {
      if (boardKey === L.key(level.board)) return level.board;
      const oldBoard = legacyBoards4[level.id];
      if (oldBoard && boardKey === L.key(oldBoard)) return oldBoard;
    }
    return null;
  }

  function validCertificate(level, certificate) {
    if (!certificate || !Array.isArray(certificate.actions) || certificate.actions.length < 1
      || certificate.actions.length > 10000 || typeof certificate.runId !== "string"
      || !/^[a-z0-9-]{3,80}$/.test(certificate.runId)
      || !boardForProof(level, certificate.generatorVersion, certificate.boardKey)) return false;
    let board = boardForProof(level, certificate.generatorVersion, certificate.boardKey);
    for (const action of certificate.actions) {
      const result = L.move(board, level.width, action);
      if (!result) return false;
      board = result.board;
    }
    return L.complete(board, level.width);
  }

  function validateRun(run) {
    if (!run || typeof run !== "object") return null;
    const level = levelById(run.levelId);
    if (!level || !Array.isArray(run.actions) || !Number.isInteger(run.cursor)
      || run.cursor < 0 || run.cursor > run.actions.length || run.actions.length > 10000
      || typeof run.runId !== "string" || !/^[a-z0-9-]{3,80}$/.test(run.runId)
      || !boardForProof(level, run.generatorVersion, run.boardKey)) return null;
    let board = boardForProof(level, run.generatorVersion, run.boardKey);
    for (const action of run.actions) {
      const next = L.move(board, level.width, action);
      if (!next) return null;
      board = next.board;
    }
    return { levelId: level.id, actions: run.actions.slice(), cursor: run.cursor,
      runId: run.runId, assisted: Boolean(run.assisted), generatorVersion: run.generatorVersion,
      boardKey: run.boardKey };
  }

  function parseSave(raw) {
    const blank = freshSave();
    try {
      if (!raw) return blank;
      const candidate = JSON.parse(raw);
      if (!candidate || candidate.schema !== 1) return blank;
      for (const level of data.levels) {
        const certificate = candidate.certificates && candidate.certificates[level.id];
        if (!validCertificate(level, certificate)) continue;
        const currentBoard = certificate.boardKey === L.key(level.board);
        blank.certificates[level.id] = { actions: certificate.actions.slice(), runId: certificate.runId,
          generatorVersion: currentBoard ? level.generatorVersion : certificate.generatorVersion,
          boardKey: certificate.boardKey };
        blank.completed[level.id] = true;
        if (currentBoard) blank.best[level.id] = certificate.actions.length;
      }
      const run = validateRun(candidate.run);
      if (run && run.boardKey === L.key(levelById(run.levelId).board)) {
        run.generatorVersion = levelById(run.levelId).generatorVersion;
        blank.run = run;
      } else if (run) blank.legacyRun = run;
      if (!blank.legacyRun) blank.legacyRun = validateRun(candidate.legacyRun);
      blank.tutorialSeen = candidate.tutorialSeen === true;
      blank.sound = candidate.sound === true;
      blank.completionIds = Array.isArray(candidate.completionIds) ? candidate.completionIds.filter((x) => typeof x === "string").slice(-200) : [];
      blank.rewardIds = Array.from({ length: 12 }, (_, index) => `flavor:${index + 1}`)
        .filter((_, index) => data.levels.slice(index * 4, index * 4 + 4).every((level) => blank.completed[level.id]));
      return blank;
    } catch (error) {
      storageOk = false;
      return blank;
    }
  }

  function browserRead() {
    try { return localStorage.getItem(STORE); }
    catch (error) { storageOk = false; return null; }
  }

  function browserWrite(raw) {
    try { localStorage.setItem(STORE, raw); storageOk = true; return true; }
    catch (error) { storageOk = false; return false; }
  }

  async function chooseStorage() {
    const xhs = window.xhs;
    const miniTool = xhs && xhs.miniTool;
    if (!miniTool || typeof miniTool.getStorage !== "function" || typeof miniTool.setStorage !== "function") return;
    let options = xhs.launchOptions;
    if (!(options && options.miniToolEnv && options.miniToolEnv.buildVersion)
      && typeof miniTool.getLaunchOptions === "function") {
      try { options = await miniTool.getLaunchOptions(); }
      catch (error) { return; }
    }
    const buildVersion = Number(options && options.miniToolEnv && options.miniToolEnv.buildVersion) || 0;
    if (Math.floor(buildVersion / 1000) >= STORAGE_MIN_CLIENT_VERSION) nativeStorage = miniTool;
  }

  async function restore() {
    await chooseStorage();
    let raw;
    let nativeReadSucceeded = false;
    if (nativeStorage) {
      try {
        const result = await nativeStorage.getStorage({ key: STORE });
        raw = result && result.data;
        nativeReadSucceeded = true;
      } catch (error) { storageOk = false; storageWritable = false; }
      // Migrate a low-version browser save once; certificate validation still
      // runs before it is accepted or written to the native store.
      if (nativeReadSucceeded && !raw) {
        const oldRaw = browserRead();
        if (oldRaw) {
          saved = parseSave(oldRaw);
          await writeSave(JSON.stringify(saved));
          return;
        }
      }
    } else raw = browserRead();
    saved = parseSave(raw);
  }

  async function writeSave(raw) {
    if (!storageWritable) { storageOk = false; return; }
    if (nativeStorage) {
      try { await nativeStorage.setStorage({ key: STORE, data: raw }); storageOk = true; }
      catch (error) { storageOk = false; }
    } else browserWrite(raw);
  }

  function persist() {
    let raw;
    try { raw = JSON.stringify(saved); }
    catch (error) { storageOk = false; return; }
    pendingWrite = pendingWrite.then(() => writeSave(raw));
  }

  function currentBoard() {
    if (!saved.run) return null;
    const level = levelById(saved.run.levelId);
    let board = level.board;
    for (const action of saved.run.actions.slice(0, saved.run.cursor)) board = L.move(board, level.width, action).board;
    return board;
  }

  function unlocked(id) {
    return id === 1 || saved.completed[id - 1] === true || saved.completed[id] === true;
  }

  function nextPlayableLevel() {
    const next = data.levels.find((level) => !saved.completed[level.id] && unlocked(level.id));
    return next ? next.id : null;
  }

  function dailyLevelId() {
    const pool = data.levels.filter((level) => saved.completed[level.id]).map((level) => level.id);
    if (!pool.length) return 1;
    const today = new Date();
    const localDay = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
    return pool[localDay % pool.length];
  }

  function startLevel(id) {
    const level = levelById(id);
    if (!level || !unlocked(id)) return;
    animationToken += 1; animating = false;
    saved.run = { levelId: id, actions: [], cursor: 0, runId: nowId(), assisted: false,
      generatorVersion: level.generatorVersion, boardKey: L.key(level.board) };
    persist();
    page = "game"; modal = null; hintStage = 0; hintText = ""; hintIndex = -1; message = "";
    hintRouteKey = ""; hintRoute = null;
    render();
    if (!saved.tutorialSeen) openTutorial();
  }

  function playSound() {
    if (!saved.sound) return;
    try {
      if (!soundContext) soundContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = soundContext.createOscillator();
      const gain = soundContext.createGain();
      oscillator.type = "sine"; oscillator.frequency.setValueAtTime(430, soundContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(580, soundContext.currentTime + .11);
      gain.gain.setValueAtTime(.035, soundContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, soundContext.currentTime + .15);
      oscillator.connect(gain).connect(soundContext.destination);
      oscillator.start(); oscillator.stop(soundContext.currentTime + .16);
    } catch (error) { /* Sound is an optional enhancement. */ }
  }

  function submit(index) {
    const run = saved.run;
    if (!run || modal || page !== "game" || animating) return;
    const level = levelById(run.levelId);
    const board = currentBoard();
    const result = L.move(board, level.width, index);
    if (!result) { message = "请选择与空位同行或同列的托盘。"; render(); return; }
    run.actions = run.actions.slice(0, run.cursor);
    run.actions.push(index);
    run.cursor += 1;
    hintStage = 0; hintText = ""; hintIndex = -1; message = "";
    hintRouteKey = ""; hintRoute = null;
    const won = L.complete(result.board, level.width);
    if (won) finish(level, run, true);
    else persist();
    playSound(); render("tile-" + index);
    animateSlide(result.line, () => { if (won) { page = "result"; render(); } });
  }

  function animateSlide(line, done) {
    const duration = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240;
    const cells = [...root.querySelectorAll("[data-tile]")];
    const moving = [];
    for (let i = 0; i < line.length - 1; i += 1) {
      const target = cells[line[i]], source = cells[line[i + 1]];
      if (!target || !source) continue;
      const a = target.getBoundingClientRect(), b = source.getBoundingClientRect();
      moving.push({ target, dx: b.left - a.left, dy: b.top - a.top });
    }
    if (!duration || !moving.length) { done(); return; }
    animating = true;
    const token = ++animationToken;
    for (const { target, dx, dy } of moving) {
      target.style.transition = "none";
      target.style.transform = `translate(${dx}px, ${dy}px)`;
      target.style.zIndex = "5";
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== animationToken) return;
      for (const { target } of moving) {
        target.style.transition = "transform 240ms cubic-bezier(.2,.8,.2,1)";
        target.style.transform = "translate(0,0)";
      }
    }));
    setTimeout(() => {
      if (token !== animationToken) return;
      animating = false;
      for (const { target } of moving) { target.style.transform = ""; target.style.transition = ""; target.style.zIndex = ""; }
      done();
    }, duration + 20);
  }

  function finish(level, run, deferScreen = false) {
    const completionId = `${level.id}:${run.runId}`;
    if (!saved.completionIds.includes(completionId)) {
      saved.completionIds.push(completionId);
      if (saved.completionIds.length > 200) saved.completionIds.shift();
      if (!run.assisted) {
        if (run.cursor < (saved.best[level.id] === undefined ? Infinity : saved.best[level.id])) {
          saved.best[level.id] = run.cursor;
          saved.certificates[level.id] = { actions: run.actions.slice(0, run.cursor), runId: run.runId,
            generatorVersion: level.generatorVersion, boardKey: L.key(level.board) };
        }
        saved.completed[level.id] = true;
        const rewardId = `flavor:${Math.ceil(level.id / 4)}`;
        const group = data.levels.slice((Math.ceil(level.id / 4) - 1) * 4, Math.ceil(level.id / 4) * 4);
        if (group.every((item) => saved.completed[item.id]) && !saved.rewardIds.includes(rewardId)) saved.rewardIds.push(rewardId);
      }
    }
    persist();
    if (!deferScreen) { page = "result"; playSound(); render(); }
  }

  function undo() {
    if (!saved.run || saved.run.cursor === 0 || animating) return;
    saved.run.cursor -= 1; persist(); hintStage = 0; hintText = ""; message = "已撤销一次滑运。"; render("undo");
  }
  function redo() {
    if (!saved.run || saved.run.cursor >= saved.run.actions.length || animating) return;
    saved.run.cursor += 1; persist(); hintStage = 0; hintText = "";
    const level = levelById(saved.run.levelId);
    if (L.complete(currentBoard(), level.width)) finish(level, saved.run);
    else { message = "已重做一次滑运。"; render("redo"); }
  }

  function routeFromCurrent() {
    const run = saved.run;
    const level = levelById(run.levelId);
    const board = currentBoard();
    if (level.width === 3) {
      const boardKey = L.key(board);
      if (hintRouteKey !== boardKey) { hintRouteKey = boardKey; hintRoute = L.shortestPath3(board); }
      return { route: hintRoute, recovering: false };
    }
    const suffix = L.referenceSuffix(board, 4, level.board, level.reference);
    if (suffix) return { route: suffix, recovering: false };
    const frames = [level.board];
    for (const action of run.actions.slice(0, run.cursor)) frames.push(L.move(frames[frames.length - 1], 4, action).board);
    const back = [];
    for (let i = frames.length - 1; i > 0; i -= 1) back.push(frames[i - 1].indexOf(0));
    return { route: back.concat(level.reference), recovering: true };
  }

  function showHint() {
    if (!saved.run || animating) return;
    const level = levelById(saved.run.levelId);
    const board = currentBoard();
    hintStage = Math.min(3, hintStage + 1);
    hintIndex = -1;
    if (hintStage === 1) hintText = `可移动的托盘有 ${L.legalIndices(board, level.width).length} 个。按住其中一格，可以预览整段路径。`;
    else {
      const guidance = routeFromCurrent();
      hintIndex = guidance.route && guidance.route.length ? guidance.route[0] : -1;
      if (hintIndex < 0) hintText = "这一盘已经归位。";
      else if (hintStage === 2) hintText = guidance.recovering
        ? `可以先把空位送回熟悉的位置。试着点亮起的 ${board[hintIndex]} 号托盘。`
        : `先为下一罐留路：观察亮起的 ${board[hintIndex]} 号托盘。`;
      else { hintText = `参考路线的下一步：点 ${board[hintIndex]} 号托盘。此局将记为练习。`; saved.run.assisted = true; persist(); }
    }
    render("hint");
  }

  function boardHtml(board, width, options = {}) {
    const legal = options.interactive ? L.legalIndices(board, width) : [];
    return `<div class="board board-${width}${options.mini ? " board-mini" : ""}" data-board aria-label="${width}乘${width}收纳棋盘" style="--size:${width}">
      ${board.map((tile, index) => {
        const target = tile ? tile - 1 : board.length - 1;
        const isLegal = legal.includes(index);
        const cls = ["cell", tile ? "jar" : "vacant", target === index ? "placed" : "", options.hint === index ? "hinted" : "", options.line && options.line.includes(index) ? "preview" : ""].filter(Boolean).join(" ");
        return options.interactive
          ? `<button type="button" class="${cls}" data-tile="${index}" data-focus="tile-${index}" aria-label="${tile ? `${tile}号果酱，${isLegal ? "可移动" : "当前不可移动"}` : "空位"}" aria-disabled="${isLegal ? "false" : "true"}" tabindex="${tile ? "0" : "-1"}"><span class="jar-shine"></span><span class="jar-label">${tile || "空位"}</span>${tile ? `<span class="target-mark" aria-hidden="true">${index + 1 === board.length ? "" : two(index + 1)}</span>` : ""}</button>`
          : `<span class="${cls}" aria-label="${tile || "空位"}"><span class="jar-shine"></span><span class="jar-label">${tile || "空位"}</span></span>`;
      }).join("")}</div>`;
  }

  function topbar(title, back = "home") {
    return `<header class="topbar"><button class="icon-button" data-action="${back}" aria-label="返回">←</button><span class="topbar-title">${escape(title)}</span><button class="icon-button" data-action="settings" aria-label="设置">⚙</button></header>`;
  }

  function homeHtml() {
    const done = Object.keys(saved.completed).length;
    const resume = saved.run && !L.complete(currentBoard(), levelById(saved.run.levelId).width);
    const next = nextPlayableLevel();
    const heroAction = resume ? "resume" : next ? "start-first" : "chapters";
    const heroLabel = resume ? `继续第 ${two(saved.run.levelId)} 关`
      : next === 1 && !done ? "开始收纳" : next ? `继续第 ${two(next)} 关` : "挑一盘再整理";
    return `<main class="shell home-page">
      <div class="window-scene" aria-hidden="true"><div class="sun-disc"></div><div class="window-frame"></div><div class="scene-jar jar-a"></div><div class="scene-jar jar-b"></div><div class="scene-jar jar-c"></div></div>
      <div class="home-title"><p class="eyebrow">午后的果酱小店</p><h1>杏橘<br>收纳所<span class="title-spark">✦</span></h1><p>把每只果酱托盘，轻轻滑回编号位置。</p></div>
      <section class="hero-card"><span class="card-stamp">今日整理</span><p>${done ? `已收好 ${done} / 48 盘` : "从第一只果酱罐开始"}</p><button class="primary-button" data-action="${heroAction}">${heroLabel}<span>→</span></button></section>
      <button class="daily-card" data-action="daily"><span>☼</span><strong>今日复盘 · 第 ${two(dailyLevelId())} 盘</strong><small>从已完成关卡按本地日期轮换</small><b>→</b></button>
      <nav class="home-links" aria-label="主菜单"><button data-action="chapters"><span class="link-icon">▦</span>六层货架<small>48 关</small></button><button data-action="collection"><span class="link-icon">✿</span>风味收藏<small>${saved.rewardIds.length} / 12</small></button><button data-action="tutorial"><span class="link-icon">◎</span>玩法教程<small>随时重看</small></button></nav>
      <p class="home-foot">留一格空位，给好事腾个地方。</p></main>`;
  }

  function chaptersHtml() {
    return `<main class="shell">${topbar("六层货架")}
      <div class="page-heading"><p class="eyebrow">慢慢整理就好</p><h1>一层一层，开门啦。</h1><p>每层八盘。完成上一盘，就能继续往前。</p></div>
      <div class="chapters">${data.chapters.map(([title, subtitle], chapter) => {
        const first = chapter * 8 + 1;
        const count = data.levels.slice(first - 1, first + 7).filter((level) => saved.completed[level.id]).length;
        const open = expandedChapter === chapter + 1;
        return `<section class="chapter ${open ? "open" : ""}"><button class="chapter-head" data-action="expand" data-chapter="${chapter + 1}" aria-expanded="${open}"><span class="chapter-number">${two(chapter + 1)}</span><span><strong>${escape(title)}</strong><small>${escape(subtitle)}</small></span><span class="chapter-progress">${count}/8 <b>${open ? "⌄" : "›"}</b></span></button>${open ? `<div class="level-grid">${data.levels.slice(first - 1, first + 7).map((level) => `<button data-action="level" data-level="${level.id}" class="level-button ${saved.completed[level.id] ? "done" : ""}" ${unlocked(level.id) ? "" : "disabled"} aria-label="第${level.id}关 ${escape(level.title)}${unlocked(level.id) ? "" : "，未解锁"}"><span>${unlocked(level.id) ? two(level.id) : "⌁"}</span><small>${saved.completed[level.id] ? "已收好" : unlocked(level.id) ? "可游玩" : "待解锁"}</small></button>`).join("")}</div>` : ""}</section>`;
      }).join("")}</div></main>`;
  }

  function gameHtml() {
    const run = saved.run;
    if (!run) { page = "home"; return homeHtml(); }
    const level = levelById(run.levelId);
    const board = currentBoard();
    return `<main class="shell game-page">${topbar("杏橘收纳所")}
      <div class="game-header"><div><p class="eyebrow">第 ${two(level.chapter)} 层 · ${escape(data.chapters[level.chapter - 1][0])}</p><h1>${two(level.id)} <span>${escape(level.title)}</span></h1></div><div class="moves"><strong>${run.cursor}</strong><span>次滑运</span></div></div>
      <div class="progress-track"><span style="width:${Math.max(4, Object.keys(saved.completed).length / 48 * 100)}%"></span></div>
      <div class="board-frame"><div class="board-topline"><span>杏橘果酱 · 今日托盘</span><span>${level.width} × ${level.width}</span></div>${boardHtml(board, level.width, { interactive: true, hint: hintIndex })}<div class="board-bottomline"><span>按住预览路径 · 松开滑运</span><span>✦</span></div></div>
      <p class="rule-line">把编号依次排好，空位留在右下角。</p>
      <div class="game-tools"><button data-action="undo" ${run.cursor ? "" : "disabled"}><span>↶</span> 撤销</button><button data-action="redo" ${run.cursor < run.actions.length ? "" : "disabled"}><span>↷</span> 重做</button><button data-action="hint"><span>✧</span> 提示 ${hintStage ? `${hintStage}/3` : ""}</button><button data-action="restart"><span>⟳</span> 重开</button></div>
      <div class="message-box" role="status" aria-live="polite">${escape(message || hintText || (run.assisted ? "本局使用了解法提示，记为练习。" : "点按与空位同行或同列的任意托盘。"))}</div>
      ${!storageOk ? `<p class="storage-warning">本局可玩，进度暂无法保存。</p>` : ""}</main>`;
  }

  function resultHtml() {
    const run = saved.run;
    if (!run) { page = "home"; return homeHtml(); }
    const level = levelById(run.levelId);
    return `<main class="shell result-page">${topbar("收纳完成", "chapters")}
      <div class="result-sun" aria-hidden="true"></div><p class="eyebrow">午后的阳光刚刚好</p><h1>开门啦！</h1><p>第 ${two(level.id)} 盘已经整齐归位。</p>
      <div class="result-board">${boardHtml(L.solved(level.width), level.width, { mini: true })}</div>
      <div class="result-stats"><div><strong>${run.cursor}</strong><span>本次滑运</span></div><div><strong>${saved.best[level.id] === undefined ? "—" : saved.best[level.id]}</strong><span>个人最佳</span></div></div>
      <p class="result-note">${run.assisted ? "这次沿提示路线练习。再独立完成一次即可记录首通。" : level.proof === "exact" ? `本关经完整搜索验证，最短为 ${level.distance} 次滑运。` : `本关有已验证的 ${level.reference.length} 次参考路线；不代表最短。`}</p>
      <button class="primary-button" data-action="${level.id < 48 && unlocked(level.id + 1) ? "next" : "chapters"}">${level.id < 48 && unlocked(level.id + 1) ? "收下一盘" : "返回货架"}<span>→</span></button><button class="text-button" data-action="replay">再整理一次</button></main>`;
  }

  function collectionHtml() {
    return `<main class="shell">${topbar("风味收藏")}
      <div class="page-heading"><p class="eyebrow">每四盘，一张新标签</p><h1>把小日子收藏起来。</h1><p>独立完成关卡，慢慢收集十二种风味。</p></div>
      <div class="flavor-grid">${flavors.map((name, index) => {
        const unlockedFlavor = data.levels.slice(index * 4, index * 4 + 4).every((level) => saved.completed[level.id]);
        return `<article class="flavor-card ${unlockedFlavor ? "" : "locked"}"><span class="flavor-fruit" aria-hidden="true">${["✿", "◒", "✦", "❀"][index % 4]}</span><small>风味 ${two(index + 1)}</small><h2>${unlockedFlavor ? escape(name) : "尚未开封"}</h2><p>${unlockedFlavor ? escape(flavorNotes[index]) : `完成第 ${two((index + 1) * 4)} 关后揭晓`}</p></article>`;
      }).join("")}</div></main>`;
  }

  function tutorialHtml() {
    if (tutorialMode === "long") return `<div class="modal-shade" data-action="modal-outside"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" data-action="close-modal" aria-label="关闭教程">×</button><p class="eyebrow">补充教学 · 长架轻推</p><h2 id="modal-title">点远端，整段一起走</h2><p>空位在左下角。点最右边的 8 号托盘，7 号和 8 号会依次向左滑一格，空位来到被点位置。这整段只计一次滑运。</p><small class="tutorial-caption">真实初态 · 亮起的是完整路径</small><div class="tutorial-board">${boardHtml(longSlideStart, 3, { mini: true, line: longSlide.line })}</div><small class="tutorial-caption">真实动作：点第 9 格（8 号）</small><div class="tutorial-board">${boardHtml(longSlide.board, 3, { mini: true })}</div><div class="modal-actions"><button data-action="tutorial-back" class="text-button">返回三张教程</button><button class="primary-button" data-action="close-modal">开始整理 <span>→</span></button></div></section></div>`;
    const card = [
      { title: "先找一格空位", body: "罐子按 1 到 8 排好，空位留在右下。点空位同行或同列的托盘。", caption: "同一题 · 起始状态" },
      { title: "轻轻滑动一段", body: "这一步真的点了 5 号罐子。它向上滑，空位来到原处；点远端时中间整段也会跟着移动。", caption: "真实动作：点第 8 格（5 号）" },
      { title: "都归位，就开门", body: "再点 8 号罐子，全部编号归位。每次完整滑运只计一步。", caption: "真实动作：点第 9 格（8 号）" },
    ][modalPage];
    return `<div class="modal-shade" data-action="modal-outside"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" data-action="close-modal" aria-label="关闭教程">×</button><p class="eyebrow">玩法小卡 · ${modalPage + 1} / 3</p><h2 id="modal-title">${card.title}</h2><p>${card.body}</p><div class="tutorial-board">${boardHtml(tutorialBoards[modalPage], 3, { mini: true })}</div><small class="tutorial-caption">${card.caption}</small><div class="modal-dots" aria-hidden="true"><i class="${modalPage === 0 ? "active" : ""}"></i><i class="${modalPage === 1 ? "active" : ""}"></i><i class="${modalPage === 2 ? "active" : ""}"></i></div>${modalPage === 2 ? `<button class="text-button tutorial-extra" data-action="tutorial-long">再看整段滑移示例 →</button>` : ""}<div class="modal-actions"><button data-action="close-modal" class="text-button">跳过 / 关闭</button><button class="primary-button" data-action="tutorial-next">${modalPage === 2 ? "开始整理" : "下一张"} <span>→</span></button></div></section></div>`;
  }

  function settingsHtml() {
    return `<div class="modal-shade" data-action="modal-outside"><section class="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" data-action="close-modal" aria-label="关闭设置">×</button><p class="eyebrow">让整理更合手</p><h2 id="modal-title">小店设置</h2><label class="setting-line"><span>轻声提示<small>首次点击后才发声</small></span><input type="checkbox" data-setting="sound" ${saved.sound ? "checked" : ""}></label><p class="setting-copy">支持系统“减少动态”设置。键盘可用方向键移动格子焦点，按 Enter 滑运。</p><button class="primary-button" data-action="close-modal">完成 <span>✓</span></button></section></div>`;
  }

  function syncBoardSizes() {
    for (const board of root.querySelectorAll("[data-board]")) {
      board.style.height = `${board.getBoundingClientRect().width}px`;
    }
  }

  function render(focusKey) {
    const previous = focusKey === undefined ? (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.focus) : focusKey;
    root.innerHTML = (page === "home" ? homeHtml() : page === "chapters" ? chaptersHtml() : page === "game" ? gameHtml()
      : page === "result" ? resultHtml() : collectionHtml()) + (modal === "tutorial" ? tutorialHtml() : modal === "settings" ? settingsHtml() : "");
    syncBoardSizes();
    document.body.classList.toggle("modal-open", Boolean(modal));
    const target = modal ? root.querySelector(".modal-close") : previous ? root.querySelector(`[data-focus="${previous}"]`) : null;
    if (target) target.focus({ preventScroll: true });
  }

  function openTutorial() { modalReturn = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.action || null; modal = "tutorial"; modalPage = 0; tutorialMode = "main"; render(); }
  function closeModal() {
    const old = modal; modal = null;
    if (old === "tutorial" && !saved.tutorialSeen) { saved.tutorialSeen = true; persist(); }
    render();
    const target = modalReturn && root.querySelector(`[data-action="${modalReturn}"]`);
    if (target) target.focus({ preventScroll: true });
  }

  root.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action], [data-tile]");
    if (!target || target.disabled) return;
    if (target.hasAttribute("data-tile")) {
      if (event.detail > 0 && cancelledPointerClick) { cancelledPointerClick = false; return; }
      submit(Number(target.dataset.tile)); return;
    }
    const action = target.dataset.action;
    if (modal && !["close-modal", "tutorial-next", "tutorial-long", "tutorial-back", "modal-outside"].includes(action)) return;
    if (action === "modal-outside") { if (event.target === target) closeModal(); return; }
    if (action === "close-modal") { closeModal(); return; }
    if (action === "tutorial-long") { tutorialMode = "long"; render(); return; }
    if (action === "tutorial-back") { tutorialMode = "main"; render(); return; }
    if (action === "tutorial-next") { if (modalPage < 2) { modalPage += 1; render(); const card = root.querySelector(".modal-card"); if (card) card.scrollTop = 0; } else closeModal(); return; }
    if (animating && !["home", "chapters", "collection"].includes(action)) return;
    if (action === "settings") { modalReturn = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.action || null; modal = "settings"; render(); return; }
    if (action === "tutorial") { openTutorial(); return; }
    if (action === "home" || action === "chapters" || action === "collection") { animationToken += 1; animating = false; page = action; render(); return; }
    if (action === "expand") { expandedChapter = Number(target.dataset.chapter); render(); return; }
    if (action === "level") { startLevel(Number(target.dataset.level)); return; }
    if (action === "start-first") { const next = nextPlayableLevel(); if (next) startLevel(next); return; }
    if (action === "daily") { startLevel(dailyLevelId()); return; }
    if (action === "resume") { page = "game"; render(); return; }
    if (action === "undo") { undo(); return; }
    if (action === "redo") { redo(); return; }
    if (action === "hint") { showHint(); return; }
    if (action === "restart" || action === "replay") { startLevel(saved.run.levelId); return; }
    if (action === "next") { startLevel(saved.run.levelId + 1); return; }
  });

  root.addEventListener("change", (event) => {
    if (event.target.dataset.setting === "sound") { saved.sound = event.target.checked; persist(); }
  });

  let pressed = null;
  root.addEventListener("pointerdown", (event) => {
    const tile = event.target.closest("[data-tile]");
    if (!tile || modal || !saved.run || animating) return;
    const index = Number(tile.dataset.tile);
    const level = levelById(saved.run.levelId);
    const line = L.affectedIndices(currentBoard(), level.width, index);
    if (!line.length) return;
    cancelledPointerClick = false;
    pressed = { index, pointerId: event.pointerId };
    for (const at of line) { const cell = root.querySelector(`[data-tile="${at}"]`); if (cell) cell.classList.add("preview"); }
  });
  const clearPreview = () => {
    pressed = null;
    root.querySelectorAll(".preview").forEach((cell) => cell.classList.remove("preview"));
  };
  root.addEventListener("pointermove", (event) => {
    if (!pressed || event.pointerId !== pressed.pointerId) return;
    const board = root.querySelector("[data-board]");
    const rect = board && board.getBoundingClientRect();
    if (!rect || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      cancelledPointerClick = true;
      clearPreview();
    }
  });
  root.addEventListener("pointerup", clearPreview);
  root.addEventListener("pointercancel", () => { cancelledPointerClick = true; clearPreview(); });
  root.addEventListener("pointerleave", () => { if (pressed) cancelledPointerClick = true; clearPreview(); });

  root.addEventListener("keydown", (event) => {
    if (modal && event.key === "Escape") { closeModal(); return; }
    if (modal && event.key === "Tab") {
      const focusables = [...root.querySelectorAll(".modal-card button, .modal-card input")].filter((x) => !x.disabled);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    const tile = event.target.closest("[data-tile]");
    if (!tile || !saved.run) return;
    const width = levelById(saved.run.levelId).width;
    const index = Number(tile.dataset.tile);
    const delta = { ArrowUp: -width, ArrowDown: width, ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (delta === undefined) return;
    const next = index + delta;
    if (next < 0 || next >= width * width || (Math.abs(delta) === 1 && Math.floor(next / width) !== Math.floor(index / width))) return;
    event.preventDefault();
    const nextTile = root.querySelector(`[data-tile="${next}"]`);
    if (nextTile) nextTile.focus();
  });
  window.addEventListener("pagehide", persist);
  window.addEventListener("resize", syncBoardSizes);
  document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });
  restore().then(() => {
    page = saved.run ? "game" : "home";
    expandedChapter = saved.run ? chapterOf(saved.run.levelId) : 1;
    if (saved.run && L.complete(currentBoard(), levelById(saved.run.levelId).width)) page = "result";
    render();
  }).catch(() => { storageOk = false; render(); });
})();
