export const V2_STORAGE_PREFIX = "ten-realms-v2:";
export const V2_PROGRESS_KEY = `${V2_STORAGE_PREFIX}progress:v1`;

function safeSegment(value, label) {
  const segment = String(value ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(segment)) throw new TypeError(`Invalid ${label}.`);
  return segment;
}

export function tutorialStorageKey(slug, version = 1) {
  return `${V2_STORAGE_PREFIX}tutorial:${safeSegment(slug, "game slug")}:v${Math.max(1, Math.floor(version))}`;
}

export function gameStorageKey(slug, name, version = 1) {
  return `${V2_STORAGE_PREFIX}games:${safeSegment(slug, "game slug")}:${safeSegment(name, "storage name")}:v${Math.max(1, Math.floor(version))}`;
}

export function readStoredValue(key) {
  if (!String(key).startsWith(V2_STORAGE_PREFIX)) throw new TypeError("2.0 storage keys must use the ten-realms-v2: prefix.");
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredValue(key, value) {
  if (!String(key).startsWith(V2_STORAGE_PREFIX)) throw new TypeError("2.0 storage keys must use the ten-realms-v2: prefix.");
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readStoredJson(key, fallback) {
  try {
    const value = readStoredValue(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value) {
  return writeStoredValue(key, JSON.stringify(value));
}
