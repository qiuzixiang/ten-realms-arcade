// Every V3 realm owns three rule-derived SVG tutorial cards. Keeping the
// registry here lets the shared dock launch each game's native tutorial while
// avoiding a generic illustration that could drift away from its rule state.
export const REALM_TUTORIALS = Object.freeze({});

export const REALM_CONFIGS = Object.freeze({
  "time-sand-post": Object.freeze({ title: "时砂邮路局", token: "时砂邮戳", accent: "#ffc96b", accentRgb: "255, 201, 107", nativeTutorialSelector: "#tutorial-button" }),
  "molten-core-vent": Object.freeze({ title: "熔心泄压站", token: "熔心阀芯", accent: "#5fe5de", accentRgb: "95, 229, 222", nativeTutorialSelector: "#tutorial-button" }),
  "paper-crane-sanctuary": Object.freeze({ title: "纸鹤归巢台", token: "月羽折签", accent: "#efb4b1", accentRgb: "239, 180, 177", nativeTutorialSelector: "#tutorial-button" }),
  "resonance-bell-room": Object.freeze({ title: "万象共振钟房", token: "共振音徽", accent: "#f4c56a", accentRgb: "244, 197, 106", nativeTutorialSelector: "#tutorial-button" }),
  "four-spirit-habitat": Object.freeze({ title: "四灵栖境署", token: "四灵栖印", accent: "#e8d48f", accentRgb: "232, 212, 143", nativeTutorialSelector: "#tutorial-button" }),
  "star-dial-bureau": Object.freeze({ title: "星盘校准局", token: "星环校签", accent: "#a99cff", accentRgb: "169, 156, 255", nativeTutorialSelector: "#tutorial-button" }),
  "stardust-survey": Object.freeze({ title: "星屑勘测站", token: "晶核勘签", accent: "#efbc5b", accentRgb: "239, 188, 91", nativeTutorialSelector: "#tutorial-button" }),
  "coral-bloom-lab": Object.freeze({ title: "珊瑚孢群培育所", token: "珊瑚孢子", accent: "#f07f73", accentRgb: "240, 127, 115", nativeTutorialSelector: "#tutorial-button" }),
  "eclipse-watch": Object.freeze({ title: "蚀光巡检署", token: "巡界光标", accent: "#79d9f4", accentRgb: "121, 217, 244", nativeTutorialSelector: "#tutorial-button" }),
  "celestial-mural": Object.freeze({ title: "天象壁画修复室", token: "壁画星片", accent: "#8ed6c0", accentRgb: "142, 214, 192", nativeTutorialSelector: "#tutorial-button" }),
});

export function tutorialArt() {
  return "";
}
