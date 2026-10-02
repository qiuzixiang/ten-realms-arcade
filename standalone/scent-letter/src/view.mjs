const ingredients = [{ name: "玫瑰", mark: "●", color: "#a04e60" }, { name: "佛手", mark: "◆", color: "#a87323" }, { name: "雪松", mark: "■", color: "#46776a" }, { name: "鸢尾", mark: "▲", color: "#76669b" }, { name: "白麝", mark: "⬡", color: "#707263" }, { name: "乌龙", mark: "≈", color: "#975a36" }];
const ingredientName = (v) => v ? ingredients[v - 1].name : "空槽";
function peg(v) {
  return v ? `<span class="peg peg-${v}" aria-hidden="true">${ingredients[v - 1].mark}</span><span class="peg-name">${ingredients[v - 1].name}</span>` : '<span class="empty">＋</span>';
}
function row(pegs) {
  return '<span class="mini-row">' + pegs.map((v) => `<span class="mini-peg peg-${v}" title="${ingredientName(v)}">${v ? ingredients[v - 1].mark : "·"}<small>${ingredientName(v)}</small></span>`).join("") + "</span>";
}
function seals(f) {
  return `<span class="seals"><span class="exact">实印 ${f.exact}</span><span class="misplaced">空印 ${f.misplaced}</span></span>`;
}
function tutorialSVG(pegs, f, stage) {
  const w = 360, h = 180;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" data-tutorial="scent-letter-tutorial-v1" data-stage="${stage}" data-pegs="${pegs.join(",")}" data-exact="${f ? f.exact : ""}" data-misplaced="${f ? f.misplaced : ""}"><rect width="360" height="180" rx="16" fill="#f1e8d7"/><path d="M20 140H340" stroke="#c8b99b"/>${pegs.map((v, i) => `<g transform="translate(${30 + i * 80},24)"><rect x="13" y="0" width="34" height="15" rx="3" fill="#99704a"/><rect x="0" y="15" width="60" height="68" rx="14" fill="${v ? ingredients[v - 1].color : "#e2d8c5"}"/><text x="30" y="57" text-anchor="middle" fill="white" font-size="25">${v ? ingredients[v - 1].mark : "·"}</text><text x="30" y="105" text-anchor="middle" fill="#3a493f" font-size="15">${ingredientName(v)}</text></g>`).join("")}<text x="180" y="163" text-anchor="middle" fill="#3a493f" font-size="16">${f ? "实印 " + f.exact + " · 空印 " + f.misplaced : "点选槽位，再放入香材"}</text></svg>`;
}
export {
  ingredientName,
  ingredients,
  peg,
  row,
  seals,
  tutorialSVG
};
