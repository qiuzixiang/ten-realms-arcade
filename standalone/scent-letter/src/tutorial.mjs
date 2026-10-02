import { PARAMS, secretFor, newRun, submit, edit } from "./engine.mjs";
const tutorialLevel = { id: "scent-letter-tutorial-v1", params: PARAMS(), clues: [], seed: "" };
for (let i = 0; i < 1e4; i++) {
  const seed = "scent-letter-tutorial-v1:" + i;
  if (secretFor({ ...tutorialLevel, seed }).join(",") === "1,1,2,3") {
    tutorialLevel.seed = seed;
    break;
  }
}
if (!tutorialLevel.seed) throw Error("Tutorial seed missing");
function tutorialStates() {
  let run = newRun(tutorialLevel, "tutorial");
  const states = [run];
  for (const guess of [[1, 2, 1, 4], [1, 1, 2, 3]]) {
    guess.forEach((v, i) => {
      run = edit(tutorialLevel, run, i, v);
    });
    run = submit(tutorialLevel, run);
    states.push(run);
  }
  return states;
}
export {
  tutorialLevel,
  tutorialStates
};
