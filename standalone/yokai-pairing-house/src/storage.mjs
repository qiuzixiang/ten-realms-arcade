// Prefer the documented XHS Storage API on client 9.46+, then fall back for older clients.
const KEYS = [
  'mini-polish:yokai-pairing-house:v1:profile',
  'mini-polish:yokai-pairing-house:v1:session',
  'mini-polish:yokai-pairing-house:v1:outbox',
  'mini-polish:yokai-pairing-house:v1:tutorial:yokai-pairing-house-tutorial-v1',
];

export async function createStorage() {
  var browserStorage = null;
  try { browserStorage = window.localStorage; } catch (_) { /* unavailable in some sandboxes */ }
  var xhs = window.xhs;
  var api = xhs && xhs.miniTool;
  var launch = xhs && xhs.launchOptions;
  if ((!launch || !launch.miniToolEnv) && api && typeof api.getLaunchOptions === 'function') {
    try { launch = await api.getLaunchOptions(); } catch (_) { launch = null; }
  }
  var version = Math.floor((Number(launch && launch.miniToolEnv && launch.miniToolEnv.buildVersion) || 0) / 1000);
  var nativeReady = version >= 9460 && api && typeof api.getStorage === 'function' && typeof api.setStorage === 'function';
  var cache = {};
  var queue = Promise.resolve();
  var failed = false;
  if (nativeReady) {
    for (var i = 0; i < KEYS.length; i += 1) {
      var key = KEYS[i];
      try {
        var response = await api.getStorage({ key: key });
        if (response && typeof response.data === 'string') { cache[key] = response.data; continue; }
      } catch (_) { /* browser data may still hold an older save */ }
      try {
        var previous = browserStorage && browserStorage.getItem(key);
        if (typeof previous === 'string') {
          cache[key] = previous;
          queue = queue.then((function (migrationKey, migrationData) {
            return function () { return api.setStorage({ key: migrationKey, data: migrationData }); };
          })(key, previous)).catch(function () { failed = true; });
        }
      } catch (_) { /* missing browser fallback */ }
    }
    await queue;
  }
  return {
    mode: nativeReady ? 'xhs-storage' : 'browser-storage',
    getItem: function (key) {
      if (nativeReady) return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
      try { return browserStorage ? browserStorage.getItem(key) : null; } catch (_) { return null; }
    },
    setItem: function (key, value) {
      var serialized = String(value);
      if (nativeReady) {
        cache[key] = serialized;
        queue = queue.then(function () { return api.setStorage({ key: key, data: serialized }); }).catch(function () { failed = true; });
        return;
      }
      if (!browserStorage) throw new Error('Browser storage unavailable');
      browserStorage.setItem(key, serialized);
    },
    flush: async function () { await queue; var ok = !failed; failed = false; return ok; },
  };
}
