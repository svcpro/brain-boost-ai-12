const CACHE_PREFIX = "offline-cache:";

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
