import { rectKey } from "./logic.mjs";

export const DREAM_SCENES = Object.freeze([
  Object.freeze({ name: "月湾", glyph: "☾", color: "#9d7be7" }),
  Object.freeze({ name: "云池", glyph: "☁", color: "#7bd8cf" }),
  Object.freeze({ name: "星野", glyph: "✦", color: "#e6bd70" }),
  Object.freeze({ name: "花钟", glyph: "✾", color: "#cf84b6" }),
  Object.freeze({ name: "潮声", glyph: "≋", color: "#7d9ae8" }),
  Object.freeze({ name: "森歌", glyph: "▲", color: "#8fe2b2" }),
  Object.freeze({ name: "雪灯", glyph: "✲", color: "#d4e1ff" }),
  Object.freeze({ name: "晨羽", glyph: "⌑", color: "#e6a989" }),
]);

export function hashIndex(text, length) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash, 31) + text.charCodeAt(index);
  return Math.abs(hash) % length;
}

export function sceneForLevel(levelId, room) {
  return DREAM_SCENES[hashIndex(`${levelId}:${rectKey(room)}`, DREAM_SCENES.length)];
}
