import { mkdir, writeFile } from "node:fs/promises";
import { LEVELS } from "../src/levels.mjs";
import { createTutorialStates, renderTutorialMap } from "../src/tutorial.mjs";
const level = LEVELS[0];
const states = createTutorialStates(level);
const cards = [
  ["01-elements.svg", states.initial, "初始神龛：固定灵色不能更改"],
  ["02-action.svg", states.afterAction, `合法操作：为第 ${states.action.region + 1} 境安置${["水麟", "火羽", "月狐", "森龟"][states.action.colour]}`],
  ["03-goal.svg", states.completed, "完成状态：全部着色且共享边界无冲突"],
];
const directory = new URL("../assets/tutorial/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const [file, state, caption] of cards) await writeFile(new URL(file, directory), renderTutorialMap(level, state, caption));
await writeFile(new URL("states.json", directory), JSON.stringify({ levelId: level.id, seed: level.seed, action: states.action, moveCounts: [states.initial.moves, states.afterAction.moves, states.completed.moves], solved: true }, null, 2));
console.log(`Rendered 3 rule-checked tutorial states from ${level.id}.`);
