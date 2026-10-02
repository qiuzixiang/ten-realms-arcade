import { scoreGuess, generateSecret, enumerateSecrets, hashSeed } from "./source-logic.mjs";
const VERSION = "v1";
const PARAMS = (colours = 4, slots = 4, guesses = 10) => ({ colours, slots, guesses, allowBlank: false, allowDuplicates: true });
function feedback(secret, guess, p) {
  return scoreGuess(secret, guess, p);
}
function candidates(level, history = []) {
  return enumerateSecrets(level.params).filter((s) => level.clues.concat(history).every((r) => {
    const f = feedback(s, r.pegs, level.params);
    return f.exact === r.feedback.exact && f.misplaced === r.feedback.misplaced;
  }));
}
function secretFor(level) {
  return generateSecret(level.seed, level.params);
}
function newRun(level, id, practice = false) {
  return { levelId: level.id, runId: id, history: [], draft: Array(level.params.slots).fill(0), undo: [], notes: [], hints: 0, practice, status: "playing" };
}
function submit(level, run) {
  if (run.status !== "playing" || run.draft.length !== level.params.slots || run.draft.some((v) => !Number.isInteger(v) || v < 1 || v > level.params.colours)) return run;
  const f = feedback(secretFor(level), run.draft, level.params);
  const history = run.history.concat([{ pegs: run.draft.slice(), feedback: f }]);
  return { ...run, history, draft: Array(level.params.slots).fill(0), undo: [], status: f.exact === level.params.slots ? "won" : history.length >= level.params.guesses ? "lost" : "playing" };
}
function edit(level, run, index, value) {
  if (run.status !== "playing" || !Number.isInteger(index) || index < 0 || index >= level.params.slots || !Number.isInteger(value) || value < 0 || value > level.params.colours) return run;
  const draft = run.draft.slice();
  draft[index] = value;
  return { ...run, draft, undo: run.undo.concat([run.draft]).slice(-30) };
}
function undo(run) {
  return run.status === "playing" && run.undo.length ? { ...run, draft: run.undo[run.undo.length - 1], undo: run.undo.slice(0, -1) } : run;
}
function restore(level, data) {
  try {
    if (!data || typeof data.runId !== "string" || data.runId.length > 100 || !Array.isArray(data.history) || data.history.length > level.params.guesses) return null;
    let run = newRun(level, data.runId, data.practice === true);
    for (const r of data.history) {
      if (run.status !== "playing" || !Array.isArray(r.pegs)) return null;
      const next = submit(level, { ...run, draft: r.pegs });
      if (next.history.length !== run.history.length + 1) return null;
      run = next;
    }
    if (!Array.isArray(data.draft) || data.draft.length !== level.params.slots || data.draft.some((v) => !Number.isInteger(v) || v < 0 || v > level.params.colours)) return null;
    return { ...run, draft: run.status === "playing" ? data.draft.slice() : run.draft, hints: Number.isInteger(data.hints) && data.hints >= 0 ? data.hints : 0, undo: run.status === "playing" && Array.isArray(data.undo) ? data.undo.filter((a) => Array.isArray(a) && a.length === level.params.slots && a.every((v) => Number.isInteger(v) && v >= 0 && v <= level.params.colours)).slice(-30) : [], notes: Array.isArray(data.notes) ? data.notes.filter((v) => Number.isInteger(v) && v > 0 && v <= level.params.colours) : [] };
  } catch {
    return null;
  }
}
function suggestion(level, run) {
  const pool = candidates(level, run.history);
  return { count: pool.length, pegs: pool[0] || null };
}
function dailyLevel(levels, date = /* @__PURE__ */ new Date()) {
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  const source = levels[30 + hashSeed(day + VERSION) % 20];
  return { ...source, id: "daily:" + day + ":" + VERSION, title: "今日来信 · " + day, mode: "daily", sourceId: source.id };
}
export {
  PARAMS,
  VERSION,
  candidates,
  dailyLevel,
  edit,
  feedback,
  hashSeed,
  newRun,
  restore,
  scoreGuess,
  secretFor,
  submit,
  suggestion,
  undo
};
