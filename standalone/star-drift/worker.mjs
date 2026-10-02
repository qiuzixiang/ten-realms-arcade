import { solve } from './core.mjs';
import { createDailyLevel, createExpeditionLevel } from './levels.mjs';
self.addEventListener('message', ({ data }) => {
  try {
    const result = data.type === 'hint' ? solve(data.game, { maxStates: 100000 })
      : data.type === 'daily' ? createDailyLevel(data.date)
      : createExpeditionLevel(data.seed, data.difficulty);
    self.postMessage({ id: data.id, result });
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
});
