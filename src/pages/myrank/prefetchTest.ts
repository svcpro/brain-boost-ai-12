import { supabase } from "@/integrations/supabase/client";

/**
 * Cache of in-flight or completed `start_test` requests keyed by category.
 * Lets the landing page kick off question generation on pointerdown,
 * so MyRankTest can reuse the result immediately on mount instead of
 * waiting another 3-15s for the AI call.
 */
const cache = new Map<string, Promise<{ data: any; error: any; startedAt: number }>>();

const STALE_MS = 30_000; // re-fetch if older than 30s

const getOrCreateAnonId = () => {
  let id = localStorage.getItem("myrank_anon_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("myrank_anon_id", id);
  }
  return id;
};

export function prefetchTest(category: string, userId?: string | null) {
  const existing = cache.get(category);
  if (existing) {
    // Re-use unless it errored and is older than STALE_MS
    return existing;
  }

  const anonId = getOrCreateAnonId();
  const ref = sessionStorage.getItem("myrank_ref");

  const p = supabase.functions
    .invoke("myrank-engine", {
      body: {
        action: "start_test",
        category,
        anon_session_id: anonId,
        user_id: userId || null,
        referred_by_code: ref,
      },
    })
    .then((r) => ({ data: r.data, error: r.error, startedAt: Date.now() }))
    .catch((e) => ({ data: null, error: e, startedAt: Date.now() }));

  cache.set(category, p);

  // Auto-clear stale failures so user can retry
  p.then((r) => {
    if (r.error) {
      setTimeout(() => {
        if (cache.get(category) === p) cache.delete(category);
      }, 2000);
    } else {
      // Successful result — clear after STALE_MS so next visit is fresh
      setTimeout(() => {
        if (cache.get(category) === p) cache.delete(category);
      }, STALE_MS);
    }
  });

  return p;
}

export function consumePrefetched(category: string) {
  const p = cache.get(category);
  if (p) cache.delete(category);
  return p;
}

/** Preload the MyRankTest lazy chunk so it's ready instantly on click. */
let chunkPreloaded = false;
export function preloadTestChunk() {
  if (chunkPreloaded) return;
  chunkPreloaded = true;
  import("@/pages/myrank/MyRankTest");
}
