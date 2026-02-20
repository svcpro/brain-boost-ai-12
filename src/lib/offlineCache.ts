const CACHE_PREFIX = "offline-cache:";
const CACHE_VERSION_KEY = "offline-cache-version";
const CURRENT_CACHE_VERSION = "v5"; // bump to clear corrupted mission JSON caches

// Auto-clear stale caches from previous versions
try {
  if (localStorage.getItem(CACHE_VERSION_KEY) !== CURRENT_CACHE_VERSION) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
    console.log("[Cache] Cleared stale caches, upgraded to", CURRENT_CACHE_VERSION);
  }
} catch { /* ignore */ }

export function setCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Storage full – silently skip
  }
}

export function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return (JSON.parse(raw) as { data: T }).data;
  } catch {
    // Corrupted cache — remove it
    try { localStorage.removeItem(CACHE_PREFIX + key); } catch {}
    return null;
  }
}

export function clearCache(key: string): void {
  localStorage.removeItem(CACHE_PREFIX + key);
}

/**
 * Wraps an async fetcher with offline cache.
 * Returns cached data immediately, then fetches fresh data.
 * If fetch fails (offline), cached data remains.
 */
export async function withOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  setter: (data: T) => void
): Promise<T | null> {
  // Load from cache first for instant display
  const cached = getCache<T>(key);
  if (cached !== null) {
    setter(cached);
  }

  try {
    const fresh = await fetcher();
    setter(fresh);
    setCache(key, fresh);
    return fresh;
  } catch {
    // Offline – cached data already set above
    return cached;
  }
}
