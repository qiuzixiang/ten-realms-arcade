import { PREFIX } from './store.mjs';

const KEYS = ['session', 'records', 'outbox', 'tutorial:v1'];
// In the XHS container, read the native cache before opening the UI. On older
// clients or the web, use browser storage and report write failures.
export async function createPlatformStorage(host = typeof window !== 'undefined' ? window.xhs : undefined,
  browserStorage = typeof localStorage !== 'undefined' ? localStorage : undefined) {
  const api = host && host.miniTool;
  let options = host && host.launchOptions;
  if (!options && api && typeof api.getLaunchOptions === 'function') {
    try { options = await api.getLaunchOptions(); } catch (error) { options = null; }
  }
  const version = Math.floor((Number(options && options.miniToolEnv && options.miniToolEnv.buildVersion) || 0) / 1000);
  if (version < 9460 || !api || typeof api.getStorage !== 'function' || typeof api.setStorage !== 'function') {
    return {
      getItem(key) { try { return browserStorage ? browserStorage.getItem(key) : null; } catch (error) { return null; } },
      setItem(key, value) { if (!browserStorage) throw new Error('Browser storage unavailable'); browserStorage.setItem(key, value); },
      async flush() { return true; },
      kind: 'browser',
    };
  }
  const cache = new Map(), pending = [];
  for (const suffix of KEYS) {
    const key = PREFIX + suffix;
    try {
      const result = await api.getStorage({ key });
      if (result && typeof result.data === 'string') cache.set(key, result.data);
    } catch (error) { /* missing native keys are normal */ }
  }
  return {
    kind: 'xhs',
    getItem(key) { return cache.has(key) ? cache.get(key) : null; },
    setItem(key, value) {
      const text = String(value);
      if (text.length > 1024 * 1024) throw new RangeError('Native storage key too large');
      cache.set(key, text);
      pending.push(Promise.resolve().then(() => api.setStorage({ key, data: text })).then(() => true, () => false));
    },
    async flush() {
      const batch = pending.splice(0);
      return (await Promise.all(batch)).every(Boolean);
    },
  };
}
