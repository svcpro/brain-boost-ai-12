/**
 * Simple in-memory TTL cache for edge functions.
 * Reduces database load for hot data (leaderboards, stats, configs).
 * 
 * NOTE: Each edge function instance has its own cache.
 * Under high traffic, multiple instances share DB load reduction.
 * 
 * Usage:
 *   import { edgeCache } from "../_shared/cache.ts";
 *   const data = await edgeCache.getOrFetch("leaderboard", 60, async () => { ... });
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class EdgeCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxEntries: number;

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
  }

  /**
   * Get cached data or fetch it if expired/missing.
   * @param key - Cache key
   * @param ttlSeconds - Time to live in seconds
   * @param fetcher - Async function to fetch fresh data
   * @param staleWhileRevalidate - Return stale data while fetching fresh (default: true)
   */
  async getOrFetch<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    staleWhileRevalidate = true
  ): Promise<T> {
    const now = Date.now();
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    // Cache hit and still fresh
    if (entry && entry.expiresAt > now) {
      return entry.data;
    }

    // Stale but usable — return stale, refresh in background
    if (entry && staleWhileRevalidate) {
      this.refreshInBackground(key, ttlSeconds, fetcher);
      return entry.data;
    }

    // Cache miss or expired — fetch fresh
    return await this.fetchAndStore(key, ttlSeconds, fetcher);
  }

  /**
   * Manually set a cache entry.
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.evictIfNeeded();
    const now = Date.now();
    this.store.set(key, {
      data,
      expiresAt: now + ttlSeconds * 1000,
      createdAt: now,
    });
  }

  /**
   * Invalidate a specific key or pattern.
   */
  invalidate(keyOrPattern: string): void {
    if (keyOrPattern.includes("*")) {
      const prefix = keyOrPattern.replace("*", "");
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) this.store.delete(key);
      }
    } else {
      this.store.delete(keyOrPattern);
    }
  }

  /**
   * Get cache stats for monitoring.
   */
  stats() {
    const now = Date.now();
    let fresh = 0, stale = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) fresh++;
      else stale++;
    }
    return { total: this.store.size, fresh, stale, maxEntries: this.maxEntries };
  }

  private async fetchAndStore<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const data = await fetcher();
    this.set(key, data, ttlSeconds);
    return data;
  }

  private refreshInBackground<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): void {
    this.fetchAndStore(key, ttlSeconds, fetcher).catch(err => {
      console.error(`Cache background refresh failed for ${key}:`, err);
    });
  }

  private evictIfNeeded(): void {
    if (this.store.size < this.maxEntries) return;
    // Evict oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) this.store.delete(oldestKey);
  }
}

// Singleton instance shared across requests in the same edge function instance
export const edgeCache = new EdgeCache(200);
