// Each V4 game owns its native, rule-derived three-card SVG tutorial. The
// shared rail only provides the game identity and delegates to #tutorial-button.
export const REALM_TUTORIALS = Object.freeze({});

export const REALM_CONFIGS = Object.freeze({
  "time-cargo-bay": Object.freeze({ title: "时序货舱", token: "回环货签", accent: "#ffbd66", accentRgb: "255, 189, 102", nativeTutorialSelector: "#tutorial-button" }),
  "quantum-apothecary": Object.freeze({ title: "量子配方馆", token: "反应徽记", accent: "#a9d5ff", accentRgb: "169, 213, 255", nativeTutorialSelector: "#tutorial-button" }),
  "lunar-tide-seal": Object.freeze({ title: "月潮结界", token: "潮线刻印", accent: "#d7b8ff", accentRgb: "215, 184, 255", nativeTutorialSelector: "#tutorial-button" }),
  "orbital-formation": Object.freeze({ title: "轨道编队调度", token: "编队信标", accent: "#76e4e0", accentRgb: "118, 228, 224", nativeTutorialSelector: "#tutorial-button" }),
  "archipelago-guard": Object.freeze({ title: "群岛边防署", token: "巡防界牌", accent: "#f2c879", accentRgb: "242, 200, 121", nativeTutorialSelector: "#tutorial-button" }),
  "shadow-print-lab": Object.freeze({ title: "影印净化室", token: "净化封蜡", accent: "#d8a6ef", accentRgb: "216, 166, 239", nativeTutorialSelector: "#tutorial-button" }),
  "orbit-atlas": Object.freeze({ title: "环轨星图台", token: "天图环签", accent: "#8cccf6", accentRgb: "140, 204, 246", nativeTutorialSelector: "#tutorial-button" }),
  "stellar-archive": Object.freeze({ title: "星图档案院", token: "馆藏星章", accent: "#f2ab82", accentRgb: "242, 171, 130", nativeTutorialSelector: "#tutorial-button" }),
  "balance-terrace": Object.freeze({ title: "天平阶梯庭", token: "阶位铭牌", accent: "#b7df82", accentRgb: "183, 223, 130", nativeTutorialSelector: "#tutorial-button" }),
  "daynight-loom": Object.freeze({ title: "昼夜织机", token: "经纬纹章", accent: "#f6da7d", accentRgb: "246, 218, 125", nativeTutorialSelector: "#tutorial-button" }),
});

export function tutorialArt() { return ""; }
